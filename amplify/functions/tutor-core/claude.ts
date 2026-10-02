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

// Models that accept {role: "system"} entries mid-conversation (how the
// tutor delivers each turn's household context). Others get the context
// folded into the user turn instead.
const NO_MID_CONVERSATION_SYSTEM = new Set([
	"claude-sonnet-5",
	"anthropic.claude-sonnet-5",
]);

// Models documented to accept the Claude API's server-side `fallbacks`.
const SERVER_FALLBACK_MODELS = new Set([
	"claude-opus-5-5",
	"claude-opus-5",
	"claude-sonnet-5-5",
	"claude-fable-5-1",
]);

// Replaces mid-conversation system messages with a text block on the user
// turn they follow. Deterministic, so replayed history keeps the same prefix
// (prompt caching and thinking blocks depend on that).
export function foldSystemMessages(messages: MessageParam[]): MessageParam[] {
	const out: MessageParam[] = [];
	for (const message of messages) {
		const previous = out.at(-1);
		if (message.role === "system" && previous?.role === "user") {
			const text =
				typeof message.content === "string"
					? message.content
					: message.content
							.flatMap((b) => (b.type === "text" ? [b.text] : []))
							.join("\n\n");
			const blocks =
				typeof previous.content === "string"
					? [{ type: "text" as const, text: previous.content }]
					: previous.content;
			out[out.length - 1] = {
				...previous,
				content: [
					...blocks,
					{
						type: "text",
						text: `[Context from the app, not typed by the parent]\n${text}`,
					},
				],
			};
		} else {
			out.push(message);
		}
	}
	return out;
}

export class ClaudeModel implements ModelClient {
	#anthropic?: Anthropic;
	#bedrock?: AnthropicBedrockMantle;
	#model: string;
	// Pins the rest of this turn to the fallback model once it has taken over.
	#fallbackState = new BetaFallbackState();

	constructor(
		provider: { kind: "anthropic"; apiKey: string } | { kind: "bedrock" },
		model: string,
	) {
		this.#model = model;
		if (provider.kind === "anthropic") {
			this.#anthropic = new Anthropic({ apiKey: provider.apiKey });
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
			messages: withCacheBreakpoint(
				NO_MID_CONVERSATION_SYSTEM.has(this.#model)
					? foldSystemMessages(request.messages)
					: request.messages,
			),
		};
		if (this.#anthropic) {
			// The Claude API handles refusal fallbacks server-side.
			return this.#anthropic.beta.messages.stream(
				SERVER_FALLBACK_MODELS.has(this.#model)
					? {
							...params,
							betas: ["server-side-fallback-2026-07-01"],
							fallbacks: "default",
						}
					: params,
			);
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
