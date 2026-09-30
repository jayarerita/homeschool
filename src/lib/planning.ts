// Pure planning helpers (no backend access) so they can be unit-tested.

export const SORT_GAP = 10;

type Sortable = {
	id: string;
	sortOrder: number;
	startTime?: string | null;
};

export type InsertPlan = {
	sortOrder: number;
	// Existing items that must be renumbered to make room (usually empty).
	renumber: { id: string; sortOrder: number }[];
};

// Where a new item goes: after every item that starts at or before it, or at
// the end when it has no start time. Items keep their current relative order.
export function planInsert(
	items: readonly Sortable[],
	startTime?: string | null,
): InsertPlan {
	const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
	let index = sorted.length;
	if (startTime) {
		const next = sorted.findIndex(
			(item) => item.startTime && item.startTime > startTime,
		);
		if (next !== -1) index = next;
	}

	const before = sorted[index - 1]?.sortOrder ?? 0;
	const after = sorted[index]?.sortOrder;
	if (after === undefined) {
		return { sortOrder: before + SORT_GAP, renumber: [] };
	}
	if (after - before > 1) {
		return { sortOrder: Math.floor((before + after) / 2), renumber: [] };
	}

	// No room: renumber everything with fresh gaps around the new slot.
	const renumber = sorted
		.map((item, i) => ({
			id: item.id,
			sortOrder: (i < index ? i + 1 : i + 2) * SORT_GAP,
			current: item.sortOrder,
		}))
		.filter((r) => r.sortOrder !== r.current)
		.map(({ id, sortOrder }) => ({ id, sortOrder }));
	return { sortOrder: (index + 1) * SORT_GAP, renumber };
}

// New sort orders after moving the item at `index` by `delta` places.
export function planMove(
	items: readonly Sortable[],
	index: number,
	delta: -1 | 1,
): { id: string; sortOrder: number }[] {
	const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
	const target = index + delta;
	if (target < 0 || target >= sorted.length) return [];
	[sorted[index], sorted[target]] = [sorted[target], sorted[index]];
	return sorted
		.map((item, i) => ({
			id: item.id,
			sortOrder: (i + 1) * SORT_GAP,
			current: item.sortOrder,
		}))
		.filter((r) => r.sortOrder !== r.current)
		.map(({ id, sortOrder }) => ({ id, sortOrder }));
}

// 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD key in local time.
export function weekdayOf(dateKey: string): number {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(y, m - 1, d).getDay();
}

export const WEEKDAYS = [
	{ value: 0, short: "Su", label: "Sunday" },
	{ value: 1, short: "Mo", label: "Monday" },
	{ value: 2, short: "Tu", label: "Tuesday" },
	{ value: 3, short: "We", label: "Wednesday" },
	{ value: 4, short: "Th", label: "Thursday" },
	{ value: 5, short: "Fr", label: "Friday" },
	{ value: 6, short: "Sa", label: "Saturday" },
] as const;

type RoutineLike = {
	id: string;
	daysOfWeek: readonly (number | null)[];
	active?: boolean | null;
	startTime?: string | null;
};

// Active routines scheduled on this date that haven't been added yet.
export function pendingRoutines<R extends RoutineLike>(
	routines: readonly R[],
	dateKey: string,
	items: readonly { routineId?: string | null }[],
): R[] {
	const weekday = weekdayOf(dateKey);
	const applied = new Set(items.map((i) => i.routineId).filter(Boolean));
	return routines
		.filter(
			(r) =>
				r.active !== false &&
				r.daysOfWeek.includes(weekday) &&
				!applied.has(r.id),
		)
		.sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
}

type UnitLike = { startDate: string; endDate: string };

export function unitsOn<U extends UnitLike>(
	units: readonly U[],
	dateKey: string,
): U[] {
	return units.filter((u) => u.startDate <= dateKey && dateKey <= u.endDate);
}

// "a, b,, c" -> ["a", "b", "c"], or null when empty (clears the field).
export function splitList(text: string, separator = ","): string[] | null {
	const values = text
		.split(separator)
		.map((s) => s.trim())
		.filter(Boolean);
	return values.length > 0 ? values : null;
}

// Drops the nulls Amplify allows inside list fields.
export function compact<T>(
	values: readonly (T | null | undefined)[] | null | undefined,
): T[] {
	return (values ?? []).filter((v): v is T => v !== null && v !== undefined);
}
