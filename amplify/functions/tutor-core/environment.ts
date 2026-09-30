import { secret } from "@aws-amplify/backend";

// Which Claude endpoint the tutor and planner use, chosen when the backend is
// deployed:
//   TUTOR_PROVIDER=bedrock   (default) Claude in Amazon Bedrock, via the
//                            function's IAM role. Enable model access for the
//                            model in the Bedrock console first.
//   TUTOR_PROVIDER=anthropic the Claude API. Store the key with
//                            `npx ampx sandbox secret set ANTHROPIC_API_KEY`.
// TUTOR_MODEL overrides the model ID (Bedrock IDs carry an "anthropic." prefix).
const provider =
	process.env.TUTOR_PROVIDER === "anthropic" ? "anthropic" : "bedrock";

export const claudeEnvironment = {
	TUTOR_PROVIDER: provider,
	...(process.env.TUTOR_MODEL ? { TUTOR_MODEL: process.env.TUTOR_MODEL } : {}),
	...(provider === "anthropic"
		? { ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY") }
		: {}),
};
