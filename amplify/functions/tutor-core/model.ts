import type Anthropic from "@anthropic-ai/sdk";

// The tutor's conversation is kept in Claude's Messages format (that's what
// is stored and replayed); each model client translates as needed.
export type MessageParam = Anthropic.Beta.BetaMessageParam;
export type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
export type ToolDefinition = Anthropic.Beta.BetaTool;

export type StopReason =
	| "end_turn"
	| "tool_use"
	| "max_tokens"
	| "refusal"
	| "pause_turn";

// One model response, ready to append to the conversation as-is.
export type ModelStep = {
	stopReason: StopReason;
	content: ContentBlockParam[];
};

export type StepRequest = {
	system: string;
	tools: ToolDefinition[];
	messages: MessageParam[];
	onText?: (delta: string) => void;
	// The step is being re-issued; undo any partial text from the attempt.
	onRetry?: () => void;
};

export interface ModelClient {
	step(request: StepRequest): Promise<ModelStep>;
}

// Which model serves the tutor, chosen at deploy time (see ./environment.ts):
//   bedrock         Claude in Amazon Bedrock (default)
//   anthropic       the Claude API
//   bedrock-openai  any model on Bedrock's OpenAI-compatible Chat Completions
//                   endpoint, e.g. google.gemma-4-31b
export type Provider = "bedrock" | "anthropic" | "bedrock-openai";

export function provider(): Provider {
	const value = process.env.TUTOR_PROVIDER;
	return value === "anthropic" || value === "bedrock-openai"
		? value
		: "bedrock";
}

const DEFAULT_MODEL: Record<Provider, string> = {
	// Opus 4.8 rather than 5.5: Bedrock gates Opus 5.5 per account.
	bedrock: "anthropic.claude-opus-4-8",
	anthropic: "claude-opus-5-5",
	"bedrock-openai": "google.gemma-4-31b",
};

export function modelId(): string {
	return process.env.TUTOR_MODEL || DEFAULT_MODEL[provider()];
}

export async function createModelClient(): Promise<ModelClient> {
	if (provider() === "bedrock-openai") {
		const { OpenAICompatibleModel } = await import("./openai-compatible");
		return new OpenAICompatibleModel(modelId());
	}
	const { ClaudeModel } = await import("./claude");
	return new ClaudeModel(
		provider() === "anthropic" ? "anthropic" : "bedrock",
		modelId(),
	);
}

// A readable message for a failed model request, using the service's own
// error message when there is one (e.g. "model is not available for this
// account").
export function describeModelError(err: unknown): string {
	const e = err as {
		status?: number;
		error?: { error?: { message?: string }; message?: string };
		message?: string;
	};
	if (typeof e?.status === "number" || e?.error) {
		const detail = e.error?.error?.message ?? e.error?.message ?? e.message;
		return `The tutor service returned an error (${e.status ?? "network"}): ${detail}`;
	}
	return err instanceof Error ? err.message : String(err);
}
