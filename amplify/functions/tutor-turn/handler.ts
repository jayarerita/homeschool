import type { Schema } from "../../data/resource";
import { runAgent } from "../tutor-core/agent";
import { describeClaudeError } from "../tutor-core/claude";
import {
	audienceFor,
	buildContext,
	isValidTimeZone,
	loadHousehold,
	localDateKey,
} from "../tutor-core/context";
import { type DataClient, dataClient, unwrap } from "../tutor-core/data";
import type { ToolContext } from "../tutor-core/tools";
import { loadHistory, saveTurn, type TurnMessages } from "./transcript";

// How often streamed text is written to the TutorMessage the UI watches.
const FLUSH_MS = 400;

export const handler: Schema["runTutorTurn"]["functionHandler"] = async (
	event,
) => {
	const { conversationId, messageId } = event.arguments;
	const timeZone = isValidTimeZone(event.arguments.timeZone)
		? (event.arguments.timeZone as string)
		: "UTC";
	console.log("Tutor turn", { conversationId, messageId, timeZone });
	// Set up inside the try below, so a failure there is still logged.
	let client: DataClient | undefined;

	const update = async (
		fields: Omit<Schema["TutorMessage"]["updateType"], "id">,
	) => {
		if (!client) throw new Error("Data client unavailable.");
		return unwrap(
			await client.models.TutorMessage.update({ id: messageId, ...fields }),
		);
	};

	let liveText = "";
	let stepStartText = "";
	const activity: string[] = [];
	let flushTimer: ReturnType<typeof setTimeout> | undefined;
	let flushing: Promise<unknown> = Promise.resolve();
	const scheduleFlush = () => {
		flushTimer ??= setTimeout(() => {
			flushTimer = undefined;
			flushing = flushing.then(() =>
				update({ text: liveText, status: "streaming", activity }),
			);
		}, FLUSH_MS);
	};
	const stopFlushing = async () => {
		clearTimeout(flushTimer);
		flushTimer = undefined;
		await flushing.catch(() => {});
	};

	try {
		client = await dataClient();
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
				audience: audienceFor(
					conversation,
					userMessage.authorName ?? "a parent",
				),
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
		const toolContext: ToolContext = {
			client,
			household,
			today: localDateKey(now, timeZone),
			activity,
		};

		const outcome = await runAgent({
			history,
			turn,
			toolContext,
			onStepStart: () => {
				stepStartText = liveText;
				if (liveText && !liveText.endsWith("\n")) liveText += "\n\n";
			},
			onStepRetry: () => {
				liveText = stepStartText;
			},
			onText: (delta) => {
				liveText += delta;
				scheduleFlush();
			},
			onToolsDone: scheduleFlush,
		});

		await stopFlushing();
		if (outcome === "refused") {
			// Refused turns are not saved, so they don't enter the history.
			await update({
				text: `${liveText.trim()}${liveText.trim() ? "\n\n" : ""}I can't help with that one. Could you ask it another way?`,
				status: "done",
				activity,
			});
			return;
		}

		await saveTurn(conversationId, messageId, turn);
		await update({ text: liveText.trim(), status: "done", activity });
		await client.models.Conversation.update({
			id: conversationId,
			lastMessageAt: new Date().toISOString(),
		});
	} catch (err) {
		console.error("Tutor turn failed", err);
		await stopFlushing();
		const message = describeClaudeError(err);
		await update({
			text: liveText.trim(),
			status: "error",
			error: message,
			activity,
		}).catch((e) => console.error("Could not record the failure", e));
	}
};
