import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import Anthropic, {
	BetaFallbackState,
	betaRefusalFallbackMiddleware,
} from "@anthropic-ai/sdk";
import type { BetaMessageStream } from "@anthropic-ai/sdk/lib/BetaMessageStream";

// Provider and model are set at deploy time; see ./environment.ts.
const provider =
	process.env.TUTOR_PROVIDER === "anthropic" ? "anthropic" : "bedrock";

export const MODEL =
	process.env.TUTOR_MODEL ??
	(provider === "bedrock" ? "anthropic.claude-opus-5-5" : "claude-opus-5-5");

// Used only if the main model declines a request on policy grounds.
const BEDROCK_FALLBACK_MODEL = "anthropic.claude-opus-4-8";

type StreamParams = Omit<
	Anthropic.Beta.MessageCreateParamsStreaming,
	"stream" | "fallbacks" | "betas"
>;

export type TurnStream = BetaMessageStream<unknown>;

export class Claude {
	#anthropic?: Anthropic;
	#bedrock?: AnthropicBedrockMantle;
	// Pins the rest of this turn to the fallback model once it has taken over.
	#fallbackState = new BetaFallbackState();

	constructor() {
		if (provider === "anthropic") {
			// Reads ANTHROPIC_API_KEY from the environment.
			this.#anthropic = new Anthropic();
		} else {
			// Signs requests with the Lambda role's credentials.
			this.#bedrock = new AnthropicBedrockMantle({
				awsRegion: process.env.AWS_REGION,
				middleware: [
					betaRefusalFallbackMiddleware([{ model: BEDROCK_FALLBACK_MODEL }]),
				],
			});
		}
	}

	stream(params: StreamParams): TurnStream {
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
}

export { Anthropic };
