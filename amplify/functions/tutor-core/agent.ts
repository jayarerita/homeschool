import { Anthropic, Claude, MODEL } from "./claude";
import { echoableContent } from "./echo";
import { SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOL_DEFINITIONS, type ToolContext } from "./tools";

export type MessageParam = Anthropic.Beta.BetaMessageParam;

// Stop a runaway tool loop well before the Lambda timeout.
const MAX_ITERATIONS = 25;

// Marks the last block of the last message as a cache breakpoint, so each
// request caches the whole conversation so far. Only the request copy gets
// the marker; the turn's stored messages stay unchanged.
export function withCacheBreakpoint(messages: MessageParam[]): MessageParam[] {
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

export type AgentOutcome = "finished" | "refused";

// Runs the tutor's tool loop until it answers. `turn` holds this turn's
// messages so far and is appended to in place (assistant content, tool
// results), so the caller can save it verbatim afterwards.
export async function runAgent({
	history = [],
	turn,
	toolContext,
	onText,
	onStepStart,
	onStepRetry,
	onToolsDone,
}: {
	history?: MessageParam[];
	turn: MessageParam[];
	toolContext: ToolContext;
	onText?: (delta: string) => void;
	// Called before each model request, and to undo a step's partial text
	// when the step is re-issued.
	onStepStart?: () => void;
	onStepRetry?: () => void;
	onToolsDone?: () => void;
}): Promise<AgentOutcome> {
	const claude = new Claude();
	let jsonRetries = 0;

	for (let i = 0; i < MAX_ITERATIONS; i++) {
		onStepStart?.();
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
		if (onText) stream.on("text", onText);

		let message: Anthropic.Beta.BetaMessage;
		try {
			message = await stream.finalMessage();
			jsonRetries = 0;
		} catch (err) {
			// With eager input streaming, an unparseable tool input rejects the
			// stream; re-issue the step. API errors are real failures.
			if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
			onStepRetry?.();
			i--;
			continue;
		}

		if (message.stop_reason === "refusal") return "refused";
		const content = echoableContent(message.content);
		turn.push({ role: "assistant", content });

		if (message.stop_reason === "pause_turn") continue;

		const toolUses = content.filter(
			(b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
		);
		if (toolUses.length === 0) return "finished";
		if (message.stop_reason === "max_tokens") {
			throw new Error("The reply was cut off (too long).");
		}

		// Tools run one at a time: several write to the same day's ordering.
		const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
		for (const toolUse of toolUses) {
			results.push(await runTool(toolUse, toolContext));
		}
		turn.push({ role: "user", content: results });
		onToolsDone?.();
	}
	throw new Error("The tutor took too many steps on this one.");
}

// The text of the model's replies in a turn, e.g. a planner's summary.
export function replyText(turn: MessageParam[]): string {
	return turn
		.filter((m) => m.role === "assistant" && typeof m.content !== "string")
		.flatMap((m) => m.content as Anthropic.Beta.BetaContentBlockParam[])
		.filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text")
		.map((b) => b.text)
		.join("\n\n")
		.trim();
}

export { Anthropic };
