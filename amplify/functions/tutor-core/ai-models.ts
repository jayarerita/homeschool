// The AI providers and models an admin can choose in Settings. Shared by the
// backend and the app, so it must stay free of server-only imports.

export type Provider = "bedrock" | "anthropic" | "bedrock-openai";

export const PROVIDERS: readonly Provider[] = [
	"bedrock",
	"anthropic",
	"bedrock-openai",
];

// The models offered per provider; the first is the default.
export const MODELS: Record<Provider, readonly string[]> = {
	anthropic: ["claude-opus-5-5", "claude-sonnet-5-5"],
	// Opus 4.8 first: Bedrock gates Opus 5.5 and Sonnet 5.5 per account.
	bedrock: [
		"anthropic.claude-opus-4-8",
		"anthropic.claude-opus-5-5",
		"anthropic.claude-sonnet-5-5",
	],
	"bedrock-openai": ["google.gemma-4-31b"],
};

export function isProvider(value: unknown): value is Provider {
	return PROVIDERS.includes(value as Provider);
}
