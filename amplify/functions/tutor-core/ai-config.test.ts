import { describe, expect, it } from "vitest";
import { keyHint, MODELS, resolveAiConfig } from "./ai-config";

describe("resolveAiConfig", () => {
	it("uses the deployment environment when nothing is saved", () => {
		expect(resolveAiConfig(null, {})).toEqual({
			provider: "bedrock",
			model: "anthropic.claude-sonnet-5",
			anthropicApiKey: undefined,
			source: "deployment",
		});
		expect(
			resolveAiConfig(null, {
				TUTOR_PROVIDER: "anthropic",
				TUTOR_MODEL: "claude-sonnet-5-5",
				ANTHROPIC_API_KEY: "sk-env",
			}),
		).toEqual({
			provider: "anthropic",
			model: "claude-sonnet-5-5",
			anthropicApiKey: "sk-env",
			source: "deployment",
		});
	});

	it("prefers the saved choice over the environment", () => {
		expect(
			resolveAiConfig(
				{ provider: "bedrock-openai", model: "google.gemma-4-31b" },
				{ TUTOR_PROVIDER: "anthropic" },
			),
		).toMatchObject({
			provider: "bedrock-openai",
			model: "google.gemma-4-31b",
			source: "settings",
		});
	});

	it("uses a saved key, falling back to the deployment secret", () => {
		const saved = { provider: "anthropic" as const, model: "claude-opus-5-5" };
		expect(
			resolveAiConfig(
				{ ...saved, anthropicApiKey: "sk-saved" },
				{ ANTHROPIC_API_KEY: "sk-env" },
			).anthropicApiKey,
		).toBe("sk-saved");
		expect(
			resolveAiConfig(saved, { ANTHROPIC_API_KEY: "sk-env" }).anthropicApiKey,
		).toBe("sk-env");
	});

	it("falls back to the provider's default model for an unknown saved model", () => {
		expect(
			resolveAiConfig({ provider: "anthropic", model: "claude-ancient" }, {})
				.model,
		).toBe(MODELS.anthropic[0]);
	});

	it("ignores an unknown saved provider", () => {
		expect(
			resolveAiConfig({ provider: "other" as never, model: "x" }, {}).source,
		).toBe("deployment");
	});
});

describe("keyHint", () => {
	it("shows only the last four characters", () => {
		expect(keyHint("sk-ant-api03-abcdefWXYZ")).toBe("…WXYZ");
		expect(keyHint(undefined)).toBeNull();
	});
});
