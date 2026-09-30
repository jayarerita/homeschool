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
	getMyNotificationPrefs,
	hourLabel,
	NOTIFICATION_TYPES,
	type NotificationPrefs,
} from "~/lib/household";
import { disablePush, enablePush, type PushState, pushState } from "~/lib/push";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function HourSelect({
	value,
	onChange,
	label,
}: {
	value: number | null | undefined;
	onChange: (hour: number) => void;
	label: string;
}) {
	return (
		<select
			value={value ?? ""}
			onChange={(e) => onChange(Number(e.target.value))}
			aria-label={label}
			className={`${inputClass} w-28`}
		>
			{HOURS.map((h) => (
				<option key={h} value={h}>
					{hourLabel(h)}
				</option>
			))}
		</select>
	);
}

function DeviceToggle() {
	const [state, setState] = useState<PushState | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		pushState().then(setState);
	}, []);

	async function toggle() {
		setBusy(true);
		setError(null);
		try {
			if (state === "on") await disablePush();
			else await enablePush();
			setState(await pushState());
		} catch (e) {
			setError(e);
		} finally {
			setBusy(false);
		}
	}

	const description: Record<PushState, string> = {
		on: "This device gets notifications.",
		off: "This device doesn't get notifications yet.",
		denied:
			"Notifications are blocked for this site. Allow them in your browser's site settings, then reload.",
		unsupported:
			"This browser can't receive notifications. On iPhone or iPad, add Homeschool to your Home Screen (Share → Add to Home Screen) and open it from there.",
	};

	return (
		<div className="rounded-2xl bg-slate-50 p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-sm font-semibold text-slate-700">This device</p>
					<p className="text-sm text-slate-500">
						{state ? description[state] : "Checking…"}
					</p>
				</div>
				{(state === "on" || state === "off") && (
					<button
						type="button"
						onClick={toggle}
						disabled={busy}
						className={
							state === "on" ? secondaryButtonClass : primaryButtonClass
						}
					>
						{busy ? "…" : state === "on" ? "Turn off" : "Turn on"}
					</button>
				)}
			</div>
			<ErrorText error={error} />
		</div>
	);
}

export default function NotificationSettings() {
	const queryClient = useQueryClient();
	const { data: prefs, error } = useQuery({
		queryKey: ["notificationPrefs"],
		queryFn: getMyNotificationPrefs,
	});

	const save = useMutation({
		mutationFn: async (changes: Partial<Omit<NotificationPrefs, "id">>) => {
			if (!prefs) return;
			unwrap(
				await client.models.NotificationPrefs.update({
					id: prefs.id,
					...changes,
				}),
			);
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notificationPrefs"] }),
	});

	const test = useMutation({
		mutationFn: async () =>
			unwrap(await client.mutations.sendTestNotification()),
	});

	const muted = (prefs?.mutedTypes ?? []).filter((t): t is string => !!t);
	const [email, setEmail] = useState("");
	useEffect(() => {
		setEmail(prefs?.email ?? "");
	}, [prefs?.email]);

	return (
		<Section
			title="Notifications"
			description="Your own settings. Each parent chooses how they hear from the app."
		>
			<ErrorText error={error ?? save.error} />
			<div className="space-y-5">
				<DeviceToggle />

				<div>
					<span className={labelClass}>Email</span>
					<label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
						<input
							type="checkbox"
							checked={prefs?.emailEnabled ?? false}
							disabled={!prefs}
							onChange={(e) => save.mutate({ emailEnabled: e.target.checked })}
						/>
						Also send notifications by email
					</label>
					{prefs?.emailEnabled && (
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onBlur={() => {
								if (email !== (prefs.email ?? "")) {
									save.mutate({ email: email.trim() || null });
								}
							}}
							placeholder="you@example.com"
							aria-label="Notification email address"
							className={inputClass}
						/>
					)}
				</div>

				<div>
					<span className={labelClass}>Send me</span>
					<div className="space-y-1.5">
						{NOTIFICATION_TYPES.map((t) => (
							<label
								key={t.value}
								className="flex items-center gap-2 text-sm text-slate-600"
							>
								<input
									type="checkbox"
									checked={!muted.includes(t.value)}
									disabled={!prefs}
									onChange={(e) =>
										save.mutate({
											mutedTypes: e.target.checked
												? muted.filter((m) => m !== t.value)
												: [...muted, t.value],
										})
									}
								/>
								{t.label}
							</label>
						))}
					</div>
					<p className="mt-1 text-xs text-slate-400">
						Everything still appears under the bell in the app.
					</p>
				</div>

				<div>
					<span className={labelClass}>Quiet hours</span>
					<div className="flex items-center gap-2 text-sm text-slate-600">
						<HourSelect
							label="Quiet hours start"
							value={prefs?.quietStart}
							onChange={(h) => save.mutate({ quietStart: h })}
						/>
						to
						<HourSelect
							label="Quiet hours end"
							value={prefs?.quietEnd}
							onChange={(h) => save.mutate({ quietEnd: h })}
						/>
					</div>
					<p className="mt-1 text-xs text-slate-400">
						Notifications that arrive then are sent when quiet hours end. Pick
						the same hour twice to turn this off.
					</p>
				</div>

				<div className="flex items-center gap-3 border-t border-slate-100 pt-4">
					<button
						type="button"
						onClick={() => test.mutate()}
						disabled={test.isPending}
						className={secondaryButtonClass}
					>
						{test.isPending ? "Sending…" : "Send a test notification"}
					</button>
					{test.data && <p className="text-sm text-slate-600">{test.data}</p>}
				</div>
				<ErrorText error={test.error} />
			</div>
		</Section>
	);
}
