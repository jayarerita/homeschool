// Which AI serves the tutor and planner. An admin chooses it in Settings
// (stored in the household bucket at system/ai-provider.json, readable only by
// the backend); without a saved choice, the deploy-time TUTOR_PROVIDER /
// TUTOR_MODEL / ANTHROPIC_API_KEY environment applies.
import {
	GetObjectCommand,
	NoSuchKey,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

import { isProvider, MODELS, type Provider } from "./ai-models";

export { isProvider, MODELS, PROVIDERS, type Provider } from "./ai-models";

// What's saved from Settings.
export type StoredAiConfig = {
	provider: Provider;
	model: string;
	anthropicApiKey?: string;
	updatedAt?: string;
	updatedBy?: string;
};

// What the tutor uses for a request.
export type AiConfig = {
	provider: Provider;
	model: string;
	anthropicApiKey?: string;
	source: "settings" | "deployment";
};

// The saved choice wins; otherwise the deployment's environment.
export function resolveAiConfig(
	stored: StoredAiConfig | null,
	env: Record<string, string | undefined>,
): AiConfig {
	if (stored && isProvider(stored.provider)) {
		return {
			provider: stored.provider,
			model: MODELS[stored.provider].includes(stored.model)
				? stored.model
				: MODELS[stored.provider][0],
			anthropicApiKey: stored.anthropicApiKey || env.ANTHROPIC_API_KEY,
			source: "settings",
		};
	}
	const provider = isProvider(env.TUTOR_PROVIDER)
		? env.TUTOR_PROVIDER
		: "bedrock";
	return {
		provider,
		model: env.TUTOR_MODEL || MODELS[provider][0],
		anthropicApiKey: env.ANTHROPIC_API_KEY,
		source: "deployment",
	};
}

// "…AbCd" - enough to recognize a key without revealing it.
export function keyHint(key: string | undefined): string | null {
	return key ? `…${key.slice(-4)}` : null;
}

const s3 = new S3Client();
const Key = "system/ai-provider.json";
// Settings changes reach running Lambdas within this long.
const CACHE_MS = 60_000;
let cached: { at: number; value: StoredAiConfig | null } | undefined;

export async function readStoredAiConfig({
	fresh = false,
}: {
	fresh?: boolean;
} = {}): Promise<StoredAiConfig | null> {
	if (!fresh && cached && Date.now() - cached.at < CACHE_MS)
		return cached.value;
	let value: StoredAiConfig | null = null;
	try {
		const object = await s3.send(
			new GetObjectCommand({ Bucket: process.env.HOUSEHOLD_BUCKET, Key }),
		);
		value = JSON.parse((await object.Body?.transformToString()) ?? "null");
	} catch (e) {
		if (!(e instanceof NoSuchKey)) throw e;
	}
	cached = { at: Date.now(), value };
	return value;
}

export async function writeStoredAiConfig(
	config: StoredAiConfig,
): Promise<void> {
	await s3.send(
		new PutObjectCommand({
			Bucket: process.env.HOUSEHOLD_BUCKET,
			Key,
			Body: JSON.stringify(config),
			ContentType: "application/json",
			ServerSideEncryption: "AES256",
		}),
	);
	cached = { at: Date.now(), value: config };
}

export async function currentAiConfig(): Promise<AiConfig> {
	return resolveAiConfig(await readStoredAiConfig(), process.env);
}
