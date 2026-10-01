import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import Anthropic, {
	BetaFallbackState,
	betaRefusalFallbackMiddleware,
} from "@anthropic-ai/sdk";
import { echoableContent } from "./echo";
import type {
	MessageParam,
	ModelClient,
	ModelStep,
	StepRequest,
} from "./model";

// Used only if the main model declines a request on policy grounds.
const BEDROCK_FALLBACK_MODEL = "anthropic.claude-opus-4-8";

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

export class ClaudeModel implements ModelClient {
	#anthropic?: Anthropic;
	#bedrock?: AnthropicBedrockMantle;
	#model: string;
	// Pins the rest of this turn to the fallback model once it has taken over.
	#fallbackState = new BetaFallbackState();

	constructor(provider: "anthropic" | "bedrock", model: string) {
		this.#model = model;
		if (provider === "anthropic") {
			// Reads ANTHROPIC_API_KEY from the environment.
			this.#anthropic = new Anthropic();
		} else {
			// Signs requests with the Lambda role's credentials.
			this.#bedrock = new AnthropicBedrockMantle({
				awsRegion: process.env.AWS_REGION,
				// No fallback when the fallback model is the main model.
				middleware:
					model === BEDROCK_FALLBACK_MODEL
						? []
						: [
								betaRefusalFallbackMiddleware([
									{ model: BEDROCK_FALLBACK_MODEL },
								]),
							],
			});
		}
	}

	#stream(request: StepRequest) {
		const params = {
			model: this.#model,
			max_tokens: 64000,
			system: [
				{
					type: "text" as const,
					text: request.system,
					cache_control: { type: "ephemeral" as const },
				},
			],
			// eager_input_streaming lets tool inputs stream as they're generated;
			// the API then skips input validation, so tools validate with zod.
			tools: request.tools.map((t) => ({ ...t, eager_input_streaming: true })),
			thinking: { type: "adaptive" as const },
			output_config: { effort: "medium" as const },
			messages: withCacheBreakpoint(request.messages),
		};
		if (this.#anthropic) {
			// The Claude API handles refusal fallbacks server-side.
			return this.#anthropic.beta.messages.stream({
				...params,
				betas: ["server-side-fallback-2026-07-01"],
				fallbacks: "default",
			});
		}
		if (!this.#bedrock) throw new Error("No Claude client configured.");
		return this.#bedrock.beta.messages.stream(params, {
			fallbackState: this.#fallbackState,
		});
	}

	async step(request: StepRequest): Promise<ModelStep> {
		for (let attempt = 0; ; attempt++) {
			const stream = this.#stream(request);
			if (request.onText) stream.on("text", request.onText);
			try {
				const message = await stream.finalMessage();
				return {
					stopReason: message.stop_reason ?? "end_turn",
					// After a refusal fallback, drop blocks only the declining model
					// understands; otherwise content is echoed back unchanged.
					content: echoableContent(message.content),
				} as ModelStep;
			} catch (err) {
				// With eager input streaming, an unparseable tool input rejects the
				// stream; re-issue the step. API errors are real failures.
				if (err instanceof Anthropic.APIError || attempt >= 2) throw err;
				request.onRetry?.();
			}
		}
	}
}
