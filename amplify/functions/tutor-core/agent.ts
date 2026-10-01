import type Anthropic from "@anthropic-ai/sdk";
import { createModelClient, type MessageParam } from "./model";
import { SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOL_DEFINITIONS, type ToolContext } from "./tools";

export type { MessageParam };

// Stop a runaway tool loop well before the Lambda timeout.
const MAX_ITERATIONS = 25;

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
	const model = await createModelClient();

	for (let i = 0; i < MAX_ITERATIONS; i++) {
		onStepStart?.();
		const step = await model.step({
			system: SYSTEM_PROMPT,
			tools: TOOL_DEFINITIONS,
			messages: [...history, ...turn],
			onText,
			onRetry: onStepRetry,
		});

		if (step.stopReason === "refusal") return "refused";
		turn.push({ role: "assistant", content: step.content });

		if (step.stopReason === "pause_turn") continue;

		const toolUses = step.content.filter(
			(b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use",
		);
		if (toolUses.length === 0) return "finished";
		if (step.stopReason === "max_tokens") {
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
