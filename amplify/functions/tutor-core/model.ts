import type Anthropic from "@anthropic-ai/sdk";
import { currentAiConfig } from "./ai-config";

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

// The provider and model come from Settings, or the deploy-time environment
// when nothing is saved (see ./ai-config.ts).
export async function createModelClient(): Promise<ModelClient> {
	const config = await currentAiConfig();
	if (config.provider === "bedrock-openai") {
		const { OpenAICompatibleModel } = await import("./openai-compatible");
		return new OpenAICompatibleModel(config.model);
	}
	const { ClaudeModel } = await import("./claude");
	if (config.provider === "anthropic") {
		if (!config.anthropicApiKey) {
			throw new Error(
				"The tutor is set to use the Claude API, but no API key is saved. An admin can add one in Settings → AI tutor.",
			);
		}
		return new ClaudeModel(
			{ kind: "anthropic", apiKey: config.anthropicApiKey },
			config.model,
		);
	}
	return new ClaudeModel({ kind: "bedrock" }, config.model);
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
