import Anthropic from "@anthropic-ai/sdk";
import {
	isProvider,
	keyHint,
	MODELS,
	readStoredAiConfig,
	resolveAiConfig,
	type StoredAiConfig,
	writeStoredAiConfig,
} from "../tutor-core/ai-config";

export type AiSettingsResult = {
	provider: string;
	model: string;
	keyHint: string | null;
	source: string;
};

function result(stored: StoredAiConfig | null): AiSettingsResult {
	const config = resolveAiConfig(stored, process.env);
	return {
		provider: config.provider,
		model: config.model,
		keyHint: keyHint(config.anthropicApiKey),
		source: config.source,
	};
}

export async function getAiSettings(): Promise<AiSettingsResult> {
	return result(await readStoredAiConfig({ fresh: true }));
}

// Checks a Claude API key (and that the model exists for it) with a cheap
// Models API call, so a typo is caught when saving rather than mid-chat.
async function verifyAnthropicKey(
	apiKey: string,
	model: string,
): Promise<void> {
	try {
		await new Anthropic({ apiKey }).models.retrieve(model);
	} catch (e) {
		if (e instanceof Anthropic.AuthenticationError) {
			throw new Error(
				"Anthropic didn't accept that API key. Check it and try again.",
			);
		}
		if (
			e instanceof Anthropic.PermissionDeniedError ||
			e instanceof Anthropic.NotFoundError
		) {
			throw new Error(`That API key can't use ${model}.`);
		}
		if (e instanceof Anthropic.APIError) {
			throw new Error(
				`Couldn't verify the key with Anthropic (${e.status ?? "network error"}).`,
			);
		}
		throw e;
	}
}

export async function setAiSettings(
	args: {
		provider?: unknown;
		model?: unknown;
		apiKey?: unknown;
		clearApiKey?: unknown;
	},
	updatedBy: string,
): Promise<AiSettingsResult> {
	if (!isProvider(args.provider)) throw new Error("Unknown AI provider.");
	const provider = args.provider;
	const model = String(args.model ?? "");
	if (!MODELS[provider].includes(model)) {
		throw new Error(`${model} isn't offered for this provider.`);
	}

	const stored = await readStoredAiConfig({ fresh: true });
	const newKey = typeof args.apiKey === "string" ? args.apiKey.trim() : "";
	const savedKey = args.clearApiKey ? undefined : stored?.anthropicApiKey;
	const anthropicApiKey = newKey || savedKey;

	if (provider === "anthropic") {
		const key = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
		if (!key) throw new Error("Add a Claude API key to use the Claude API.");
		await verifyAnthropicKey(key, model);
	} else if (newKey) {
		// Saved for later even when another provider is selected now.
		await verifyAnthropicKey(newKey, MODELS.anthropic[0]);
	}

	const config: StoredAiConfig = {
		provider,
		model,
		...(anthropicApiKey && { anthropicApiKey }),
		updatedAt: new Date().toISOString(),
		updatedBy,
	};
	await writeStoredAiConfig(config);
	console.log("AI settings changed", { provider, model, updatedBy });
	return result(config);
}
