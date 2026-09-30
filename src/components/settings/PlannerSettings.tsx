import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Section, {
	ErrorText,
	inputClass,
	labelClass,
} from "~/components/Section";
import { client, unwrap } from "~/lib/data-client";
import {
	browserTimeZone,
	getHouseholdSettings,
	type HouseholdSettings,
	hourLabel,
} from "~/lib/household";
import { WEEKDAYS } from "~/lib/planning";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

type Editable = Partial<
	Omit<HouseholdSettings, "id" | "createdAt" | "updatedAt">
>;

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3 py-2">
			<span className="text-sm text-slate-600">{label}</span>
			{children}
		</div>
	);
}

function TextSetting({
	value,
	onSave,
	...props
}: {
	value: string | null | undefined;
	onSave: (value: string | null) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
	const [draft, setDraft] = useState(value ?? "");
	useEffect(() => {
		setDraft(value ?? "");
	}, [value]);
	return (
		<input
			{...props}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => {
				if (draft.trim() !== (value ?? "")) onSave(draft.trim() || null);
			}}
			className={inputClass}
		/>
	);
}

export default function PlannerSettings() {
	const queryClient = useQueryClient();
	const { data: settings, error } = useQuery({
		queryKey: ["householdSettings"],
		queryFn: getHouseholdSettings,
	});

	const save = useMutation({
		mutationFn: async (changes: Editable) => {
			if (!settings) return;
			unwrap(
				await client.models.HouseholdSettings.update({
					id: settings.id,
					...changes,
				}),
			);
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["householdSettings"] }),
	});

	const hourSelect = (
		key: keyof Editable,
		value: number | null | undefined,
	) => (
		<select
			value={value ?? ""}
			disabled={!settings}
			onChange={(e) => save.mutate({ [key]: Number(e.target.value) })}
			className={`${inputClass} w-28`}
		>
			{HOURS.map((h) => (
				<option key={h} value={h}>
					{hourLabel(h)}
				</option>
			))}
		</select>
	);

	const zones = Intl.supportedValuesOf?.("timeZone") ?? [];

	return (
		<Section
			title="Planner & reminders"
			description="Household-wide. The tutor drafts upcoming days for you to review, and the app sends heads-ups at these times."
		>
			<ErrorText error={error ?? save.error} />

			<label className="flex items-start gap-2 text-sm text-slate-600">
				<input
					type="checkbox"
					className="mt-1"
					checked={settings?.plannerEnabled !== false}
					disabled={!settings}
					onChange={(e) => save.mutate({ plannerEnabled: e.target.checked })}
				/>
				<span>
					Have the tutor draft upcoming days
					<span className="block text-xs text-slate-400">
						Days that don't have a plan yet get a draft with routines and
						activities; you review and publish it. Each draft is a Claude
						request, billed to your AWS account (or API key).
					</span>
				</span>
			</label>

			<div className="mt-3 divide-y divide-slate-100">
				{settings?.plannerEnabled !== false && (
					<>
						<Row label="Days ahead to draft">
							<select
								value={settings?.planDaysAhead ?? 1}
								disabled={!settings}
								onChange={(e) =>
									save.mutate({ planDaysAhead: Number(e.target.value) })
								}
								className={`${inputClass} w-28`}
							>
								{[1, 2, 3].map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
						</Row>
						<Row label="Draft plans at">
							{hourSelect("plannerHour", settings?.plannerHour)}
						</Row>
					</>
				)}
				<Row label="Ask how the day went at">
					{hourSelect("feedbackHour", settings?.feedbackHour)}
				</Row>
				<Row label="Remind me of tomorrow's materials at">
					{hourSelect("materialsHour", settings?.materialsHour)}
				</Row>
				<Row label="Weekly preview">
					<div className="flex gap-2">
						<select
							value={settings?.weeklyPreviewDay ?? 0}
							disabled={!settings}
							onChange={(e) =>
								save.mutate({ weeklyPreviewDay: Number(e.target.value) })
							}
							aria-label="Weekly preview day"
							className={`${inputClass} w-32`}
						>
							{WEEKDAYS.map((d) => (
								<option key={d.value} value={d.value}>
									{d.label}
								</option>
							))}
						</select>
						{hourSelect("weeklyPreviewHour", settings?.weeklyPreviewHour)}
					</div>
				</Row>
			</div>

			<div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
				<label className="block">
					<span className={labelClass}>Time zone</span>
					<select
						value={settings?.timeZone ?? ""}
						disabled={!settings}
						onChange={(e) => save.mutate({ timeZone: e.target.value })}
						className={inputClass}
					>
						{!zones.includes(settings?.timeZone ?? "") &&
							settings?.timeZone && (
								<option value={settings.timeZone}>{settings.timeZone}</option>
							)}
						{zones.map((z) => (
							<option key={z} value={z}>
								{z}
								{z === browserTimeZone() ? " (this device)" : ""}
							</option>
						))}
					</select>
				</label>
				<div>
					<span className={labelClass}>App address</span>
					<TextSetting
						aria-label="App address"
						type="url"
						value={settings?.appUrl}
						onSave={(v) => save.mutate({ appUrl: v })}
						placeholder="https://homeschool.example.com"
					/>
					<span className="mt-1 block text-xs text-slate-400">
						Used for links in notifications and emails.
					</span>
				</div>
				<div>
					<span className={labelClass}>Email sender</span>
					<TextSetting
						aria-label="Email sender"
						type="email"
						value={settings?.emailFrom}
						onSave={(v) => save.mutate({ emailFrom: v })}
						placeholder="homeschool@yourdomain.com"
					/>
					<span className="mt-1 block text-xs text-slate-400">
						Email notifications need an address or domain verified in Amazon
						SES. New SES accounts can only email verified addresses until AWS
						grants production access.
					</span>
				</div>
			</div>
		</Section>
	);
}
