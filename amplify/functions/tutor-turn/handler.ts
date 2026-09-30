import type { Schema } from "../../data/resource";
import { Anthropic, Claude, MODEL } from "./claude";
import {
	buildContext,
	isValidTimeZone,
	loadHousehold,
	localDateKey,
} from "./context";
import { dataClient, unwrap } from "./data";
import { echoableContent } from "./echo";
import { SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOL_DEFINITIONS, type ToolContext } from "./tools";
import { loadHistory, saveTurn, type TurnMessages } from "./transcript";

type MessageParam = Anthropic.Beta.BetaMessageParam;

// Stop a runaway tool loop well before the Lambda timeout.
const MAX_ITERATIONS = 25;
// How often streamed text is written to the TutorMessage the UI watches.
const FLUSH_MS = 400;

// Marks the last block of the last message as a cache breakpoint, so each
// request caches the whole conversation so far. Only the request copy gets
// the marker; stored transcripts stay unchanged.
function withCacheBreakpoint(messages: MessageParam[]): MessageParam[] {
	const last = messages.at(-1);
	if (!last) return messages;
	const blocks =
		typeof last.content === "string"
			? [{ type: "text" as const, text: last.content }]
			: last.content;
	const marked = blocks.map((b, i) =>
		i === blocks.length - 1
			? { ...b, cache_control: { type: "ephemeral" as const } }
			: b,
	) as MessageParam["content"];
	return [...messages.slice(0, -1), { ...last, content: marked }];
}

export const handler: Schema["runTutorTurn"]["functionHandler"] = async (
	event,
) => {
	const { conversationId, messageId } = event.arguments;
	const timeZone = isValidTimeZone(event.arguments.timeZone)
		? (event.arguments.timeZone as string)
		: "UTC";
	const client = await dataClient();

	const update = (fields: Omit<Schema["TutorMessage"]["updateType"], "id">) =>
		client.models.TutorMessage.update({ id: messageId, ...fields }).then(
			unwrap,
		);

	let liveText = "";
	const activity: string[] = [];
	let flushTimer: ReturnType<typeof setTimeout> | undefined;
	let flushing: Promise<unknown> = Promise.resolve();
	const flush = () => {
		flushing = flushing.then(() =>
			update({ text: liveText, status: "streaming", activity }),
		);
		return flushing;
	};
	const scheduleFlush = () => {
		flushTimer ??= setTimeout(() => {
			flushTimer = undefined;
			flush();
		}, FLUSH_MS);
	};
	const stopFlushing = async () => {
		clearTimeout(flushTimer);
		flushTimer = undefined;
		await flushing.catch(() => {});
	};

	try {
		const [conversation, placeholder, messages] = await Promise.all([
			client.models.Conversation.get({ id: conversationId }).then(unwrap),
			client.models.TutorMessage.get({ id: messageId }).then(unwrap),
			client.models.TutorMessage.tutorMessagesByConversation(
				{ conversationId },
				{ sortDirection: "ASC", limit: 1000 },
			).then(unwrap),
		]);
		if (!conversation) throw new Error("Conversation not found.");
		if (
			!placeholder ||
			placeholder.conversationId !== conversationId ||
			placeholder.role !== "assistant" ||
			placeholder.status !== "pending"
		) {
			throw new Error("This reply was already handled or doesn't exist.");
		}

		const index = messages.findIndex((m) => m.id === messageId);
		const earlier = messages.slice(0, index);
		const userMessage = earlier.findLast((m) => m.role === "user");
		if (!userMessage?.text) throw new Error("No question to answer.");

		const now = new Date();
		const household = await loadHousehold(client);
		const [history, context] = await Promise.all([
			loadHistory(
				conversationId,
				earlier
					.filter((m) => m.role === "assistant" && m.status === "done")
					.map((m) => m.id),
			),
			buildContext({
				client,
				household,
				conversation,
				authorName: userMessage.authorName ?? "a parent",
				now,
				timeZone,
			}),
		]);

		// This turn: the question, then the fresh household context as an
		// operator (system) message, then the model's replies and tool results.
		const turn: TurnMessages = [
			{ role: "user", content: [{ type: "text", text: userMessage.text }] },
			{ role: "system", content: context },
		];
		const claude = new Claude();
		const toolContext: ToolContext = {
			client,
			household,
			today: localDateKey(now, timeZone),
			activity,
		};

		let finished = false;
		let refused = false;
		let jsonRetries = 0;
		for (let i = 0; i < MAX_ITERATIONS && !finished; i++) {
			const textAtStart = liveText;
			if (liveText && !liveText.endsWith("\n")) liveText += "\n\n";
			const stream = claude.stream({
				model: MODEL,
				max_tokens: 64000,
				system: [
					{
						type: "text",
						text: SYSTEM_PROMPT,
						cache_control: { type: "ephemeral" },
					},
				],
				tools: TOOL_DEFINITIONS,
				thinking: { type: "adaptive" },
				output_config: { effort: "medium" },
				messages: withCacheBreakpoint([...history, ...turn]),
			});
			stream.on("text", (delta) => {
				liveText += delta;
				scheduleFlush();
			});

			let message: Anthropic.Beta.BetaMessage;
			try {
				message = await stream.finalMessage();
				jsonRetries = 0;
			} catch (err) {
				// With eager input streaming, an unparseable tool input rejects the
				// stream; re-issue the turn. API errors are real failures.
				if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
				liveText = textAtStart;
				i--;
				continue;
			}

			if (message.stop_reason === "refusal") {
				refused = true;
				break;
			}
			const content = echoableContent(message.content);
			turn.push({ role: "assistant", content });

			if (message.stop_reason === "pause_turn") continue;

			const toolUses = content.filter(
				(b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
			);
			if (toolUses.length === 0) {
				finished = true;
				break;
			}
			if (message.stop_reason === "max_tokens") {
				throw new Error("The reply was cut off (too long).");
			}

			// Tools run one at a time: several write to the same day's ordering.
			const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
			for (const toolUse of toolUses) {
				results.push(await runTool(toolUse, toolContext));
			}
			turn.push({ role: "user", content: results });
			scheduleFlush();
		}

		await stopFlushing();
		if (refused) {
			// Refused turns are not saved, so they don't enter the history.
			await update({
				text: `${liveText}${liveText ? "\n\n" : ""}I can't help with that one. Could you ask it another way?`,
				status: "done",
				activity,
			});
			return;
		}
		if (!finished)
			throw new Error("The tutor took too many steps on this one.");

		await saveTurn(conversationId, messageId, turn);
		await update({ text: liveText.trim(), status: "done", activity });
		await client.models.Conversation.update({
			id: conversationId,
			lastMessageAt: new Date().toISOString(),
		});
		return;
	} catch (err) {
		console.error("Tutor turn failed", err);
		await stopFlushing();
		const message =
			err instanceof Anthropic.APIError
				? `The tutor service returned an error (${err.status ?? "network"}).`
				: err instanceof Error
					? err.message
					: String(err);
		await update({
			text: liveText.trim(),
			status: "error",
			error: message,
			activity,
		}).catch((e) => console.error("Could not record the failure", e));
		return;
	}
};
