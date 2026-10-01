import { secret } from "@aws-amplify/backend";

// Which Claude endpoint the tutor and planner use, chosen when the backend is
// deployed:
//   TUTOR_PROVIDER=bedrock   (default) Claude in Amazon Bedrock, via the
//                            function's IAM role. Uses Claude Opus 4.8, which
//                            every Bedrock account can use.
//   TUTOR_PROVIDER=anthropic the Claude API. Store the key with
//                            `npx ampx sandbox secret set ANTHROPIC_API_KEY`.
// TUTOR_MODEL overrides the model ID (Bedrock IDs carry an "anthropic." prefix),
// e.g. anthropic.claude-opus-5-5 once Bedrock grants your account access.
const provider =
	process.env.TUTOR_PROVIDER === "anthropic" ? "anthropic" : "bedrock";

export const claudeEnvironment = {
	TUTOR_PROVIDER: provider,
	...(process.env.TUTOR_MODEL ? { TUTOR_MODEL: process.env.TUTOR_MODEL } : {}),
	...(provider === "anthropic"
		? { ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY") }
		: {}),
};
