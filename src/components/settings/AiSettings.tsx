import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Section, {
	ErrorText,
	inputClass,
	labelClass,
	primaryButtonClass,
	secondaryButtonClass,
} from "~/components/Section";
import { client, unwrap } from "~/lib/data-client";
import {
	MODELS,
	PROVIDERS,
	type Provider,
} from "../../../amplify/functions/tutor-core/ai-models";

const PROVIDER_INFO: Record<Provider, { label: string; description: string }> =
	{
		anthropic: {
			label: "Claude, with an API key",
			description:
				"The most capable tutor. Usage is billed by Anthropic to your API key; set a monthly limit in the Claude Console.",
		},
		bedrock: {
			label: "Claude on Amazon Bedrock",
			description:
				"Billed through your AWS account. Your account must be able to use Anthropic models on Bedrock.",
		},
		"bedrock-openai": {
			label: "Gemma 4 on Amazon Bedrock",
			description:
				"Works on any AWS account. A noticeably less capable tutor, and it can't read PDF or image attachments.",
		},
	};

const MODEL_LABELS: Record<string, string> = {
	"claude-opus-5-5": "Claude Opus 5.5 (best)",
	"claude-sonnet-5-5": "Claude Sonnet 5.5 (about half the cost)",
	"anthropic.claude-opus-4-8": "Claude Opus 4.8",
	"anthropic.claude-opus-5-5": "Claude Opus 5.5 (needs account access)",
	"anthropic.claude-sonnet-5-5": "Claude Sonnet 5.5 (needs account access)",
	"google.gemma-4-31b": "Gemma 4 31B",
};

async function loadAiSettings() {
	return unwrap(await client.queries.aiSettings());
}

export default function AiSettings() {
	const queryClient = useQueryClient();
	const {
		data: current,
		error,
		isLoading,
	} = useQuery({
		queryKey: ["aiSettings"],
		queryFn: loadAiSettings,
	});

	const [provider, setProvider] = useState<Provider>("bedrock");
	const [model, setModel] = useState(MODELS.bedrock[0]);
	const [apiKey, setApiKey] = useState("");
	const [replacingKey, setReplacingKey] = useState(false);

	useEffect(() => {
		if (!current) return;
		const p = current.provider as Provider;
		setProvider(p);
		setModel(current.model);
	}, [current]);

	const save = useMutation({
		mutationFn: async (vars: { apiKey?: string; clearApiKey?: boolean }) =>
			unwrap(
				await client.mutations.setAiSettings({ provider, model, ...vars }),
			),
		onSuccess: (saved) => {
			setApiKey("");
			setReplacingKey(false);
			queryClient.setQueryData(["aiSettings"], saved);
		},
	});

	const hasKey = !!current?.keyHint;
	const showKeyInput = provider === "anthropic" && (!hasKey || replacingKey);
	const changed =
		!!current &&
		(provider !== current.provider ||
			model !== current.model ||
			!!apiKey.trim());

	return (
		<Section
			title="AI tutor"
			description="Which AI the tutor and the planner use. Changes apply within a minute. Only admins see this."
		>
			{isLoading && <p className="text-sm text-slate-400">Loading…</p>}
			<ErrorText error={error} />

			<div className="space-y-2" role="radiogroup" aria-label="AI provider">
				{PROVIDERS.map((p) => (
					<label
						key={p}
						className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
							provider === p
								? "border-indigo-300 bg-indigo-50/60"
								: "border-slate-200 hover:border-slate-300"
						}`}
					>
						<input
							type="radio"
							name="ai-provider"
							className="mt-1"
							checked={provider === p}
							onChange={() => {
								setProvider(p);
								setModel(MODELS[p][0]);
								save.reset();
							}}
						/>
						<span>
							<span className="block text-sm font-semibold text-slate-700">
								{PROVIDER_INFO[p].label}
							</span>
							<span className="block text-xs text-slate-500">
								{PROVIDER_INFO[p].description}
							</span>
						</span>
					</label>
				))}
			</div>

			<div className="mt-4 space-y-4">
				{MODELS[provider].length > 1 && (
					<label className="block">
						<span className={labelClass}>Model</span>
						<select
							value={model}
							onChange={(e) => setModel(e.target.value)}
							className={inputClass}
						>
							{MODELS[provider].map((m) => (
								<option key={m} value={m}>
									{MODEL_LABELS[m] ?? m}
								</option>
							))}
						</select>
					</label>
				)}

				{provider === "anthropic" && (
					<div>
						<span className={labelClass}>Claude API key</span>
						{hasKey && !replacingKey ? (
							<div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
								<span className="flex-1 text-slate-600">
									Saved key ending in{" "}
									<span className="font-mono">{current?.keyHint}</span>
								</span>
								<button
									type="button"
									onClick={() => setReplacingKey(true)}
									className="text-xs font-semibold text-indigo-600 hover:underline"
								>
									Replace
								</button>
								<button
									type="button"
									disabled={save.isPending}
									onClick={() => {
										if (
											window.confirm(
												"Remove the saved API key? The tutor stops working until a provider with access is chosen.",
											)
										) {
											save.mutate({ clearApiKey: true });
										}
									}}
									className="text-xs font-semibold text-red-600 hover:underline"
								>
									Remove
								</button>
							</div>
						) : (
							<input
								type="password"
								autoComplete="off"
								spellCheck={false}
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="sk-ant-…"
								aria-label="Claude API key"
								className={`${inputClass} font-mono`}
							/>
						)}
						<p className="mt-1 text-xs text-slate-400">
							Create a key at console.anthropic.com. It's checked with Anthropic
							when you save and stored privately in your AWS account; it's never
							shown again in full.
						</p>
					</div>
				)}

				{current?.source === "deployment" && !changed && (
					<p className="text-xs text-slate-400">
						Nothing saved here yet, so the deployment's default is in use.
					</p>
				)}

				<ErrorText error={save.error} />
				{save.isSuccess && !changed && (
					<p className="text-sm text-emerald-700">
						Saved. The tutor will use this within a minute.
					</p>
				)}

				<div className="flex justify-end gap-2">
					{changed && (
						<button
							type="button"
							onClick={() => {
								if (current) {
									setProvider(current.provider as Provider);
									setModel(current.model);
								}
								setApiKey("");
								setReplacingKey(false);
							}}
							className={secondaryButtonClass}
						>
							Cancel
						</button>
					)}
					<button
						type="button"
						disabled={
							!changed ||
							save.isPending ||
							(showKeyInput && !apiKey.trim() && !hasKey)
						}
						onClick={() =>
							save.mutate(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
						}
						className={primaryButtonClass}
					>
						{save.isPending ? "Checking…" : "Save"}
					</button>
				</div>
			</div>
		</Section>
	);
}
