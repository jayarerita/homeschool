// Pure scheduling logic for the hourly household jobs. The Lambda runs every
// hour; each job is due once its local hour has passed, and dedupe keys on the
// notifications stop it repeating later the same day.

export type Settings = {
	timeZone: string;
	plannerEnabled: boolean;
	planDaysAhead: number;
	plannerHour: number;
	materialsHour: number;
	feedbackHour: number;
	weeklyPreviewDay: number;
	weeklyPreviewHour: number;
	appUrl: string | null;
	emailFrom: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
	timeZone: "UTC",
	plannerEnabled: true,
	planDaysAhead: 1,
	plannerHour: 16,
	materialsHour: 19,
	feedbackHour: 18,
	weeklyPreviewDay: 0,
	weeklyPreviewHour: 17,
	appUrl: null,
	emailFrom: null,
};

export type LocalClock = {
	date: string; // YYYY-MM-DD
	hour: number; // 0-23
	minute: number;
	weekday: number; // 0 = Sunday
};

export function localClock(now: Date, timeZone: string): LocalClock {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			weekday: "short",
			hourCycle: "h23",
		})
			.formatToParts(now)
			.map((p) => [p.type, p.value]),
	);
	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
			parts.weekday,
		),
	};
}

export function addDays(dateKey: string, days: number): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type Job =
	| { kind: "planner"; dates: string[] }
	| { kind: "materials"; date: string }
	| { kind: "feedback"; date: string }
	| { kind: "weekly_preview"; weekStart: string };

export function dueJobs(settings: Settings, clock: LocalClock): Job[] {
	const jobs: Job[] = [];
	const tomorrow = addDays(clock.date, 1);
	if (clock.hour >= settings.feedbackHour) {
		jobs.push({ kind: "feedback", date: clock.date });
	}
	if (clock.hour >= settings.materialsHour) {
		jobs.push({ kind: "materials", date: tomorrow });
	}
	if (settings.plannerEnabled && clock.hour >= settings.plannerHour) {
		const days = Math.min(Math.max(settings.planDaysAhead, 1), 3);
		jobs.push({
			kind: "planner",
			dates: Array.from({ length: days }, (_, i) => addDays(clock.date, i + 1)),
		});
	}
	if (
		clock.weekday === settings.weeklyPreviewDay &&
		clock.hour >= settings.weeklyPreviewHour
	) {
		jobs.push({ kind: "weekly_preview", weekStart: tomorrow });
	}
	return jobs;
}

// Quiet hours may wrap past midnight (e.g. 21 → 7). Equal start and end means
// no quiet hours.
export function inQuietHours(
	hour: number,
	start: number | null | undefined,
	end: number | null | undefined,
): boolean {
	if (start == null || end == null || start === end) return false;
	return start < end
		? hour >= start && hour < end
		: hour >= start || hour < end;
}

type ResourceLike = { label: string; type?: string | null } | null | undefined;
type ItemLike = {
	id: string;
	title: string;
	endTime?: string | null;
	startTime?: string | null;
	status?: string | null;
	source?: string | null;
	resources?: readonly ResourceLike[] | null;
};

// Physical materials to gather, de-duplicated, with the activities needing them.
export function materialsFor(
	items: readonly ItemLike[],
): { label: string; for: string[] }[] {
	const byLabel = new Map<string, { label: string; for: string[] }>();
	for (const item of items) {
		if (item.status === "skipped") continue;
		for (const r of item.resources ?? []) {
			if (r?.type !== "material") continue;
			const key = r.label.trim().toLowerCase();
			const entry = byLabel.get(key) ?? { label: r.label.trim(), for: [] };
			if (!entry.for.includes(item.title)) entry.for.push(item.title);
			byLabel.set(key, entry);
		}
	}
	return [...byLabel.values()];
}

// Activities that have happened (or should have) today and have no feedback
// yet. Routines like meals and naps don't need feedback.
export function needsFeedback(
	items: readonly ItemLike[],
	observedItemIds: ReadonlySet<string>,
	nowHHmm: string,
): ItemLike[] {
	return items.filter(
		(item) =>
			item.source !== "routine" &&
			item.status !== "skipped" &&
			!observedItemIds.has(item.id) &&
			(item.status === "done" ||
				(item.endTime ?? item.startTime ?? "00:00") <= nowHHmm),
	);
}

// "a, b and c"
export function listPhrase(values: string[]): string {
	if (values.length <= 1) return values.join("");
	return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}
