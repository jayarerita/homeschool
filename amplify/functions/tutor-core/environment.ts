import { secret } from "@aws-amplify/backend";

// Which model serves the tutor and planner, chosen when the backend is
// deployed (see ./model.ts):
//   TUTOR_PROVIDER=bedrock        (default) Claude in Amazon Bedrock, via the
//                                 function's IAM role (Claude Opus 4.8).
//   TUTOR_PROVIDER=anthropic      the Claude API (Claude Opus 5.5). Store the key
//                                 with `npx ampx sandbox secret set ANTHROPIC_API_KEY`.
//   TUTOR_PROVIDER=bedrock-openai a model on Bedrock's OpenAI-compatible
//                                 endpoint, via the IAM role (default
//                                 google.gemma-4-31b).
// TUTOR_MODEL overrides the model ID, e.g. anthropic.claude-opus-5-5 once
// Bedrock grants your account access.
const provider =
	process.env.TUTOR_PROVIDER === "anthropic" ||
	process.env.TUTOR_PROVIDER === "bedrock-openai"
		? process.env.TUTOR_PROVIDER
		: "bedrock";

export const modelEnvironment = {
	TUTOR_PROVIDER: provider,
	...(process.env.TUTOR_MODEL ? { TUTOR_MODEL: process.env.TUTOR_MODEL } : {}),
	...(provider === "anthropic"
		? { ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY") }
		: {}),
};
