import type { ColorToken } from "./colors";
import { client, type Schema, unwrap } from "./data-client";

export type Child = Schema["Child"]["type"];
export type AgendaItem = Schema["AgendaItem"]["type"];
export type Resource = Schema["ResourceRef"]["type"];
export type ResourceType = NonNullable<Resource["type"]>;
export type { ColorToken };

export type DayAgenda = {
	date: string;
	children: Child[];
	items: AgendaItem[];
};

export function toDateKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateKey: string): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

// "13:05" -> "1:05 PM"
export function formatTime(hhmm: string): string {
	const [h, m] = hhmm.split(":").map(Number);
	const suffix = h >= 12 ? "PM" : "AM";
	return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(
	start?: string | null,
	end?: string | null,
): string | undefined {
	if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
	if (start) return formatTime(start);
	return undefined;
}

export function byChildOrder(a: Child, b: Child): number {
	return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

export async function listChildren(): Promise<Child[]> {
	const children = unwrap(await client.models.Child.list({ limit: 1000 }));
	return children.sort(byChildOrder);
}

export async function getAgendaForDate(dateKey: string): Promise<DayAgenda> {
	const [children, items] = await Promise.all([
		listChildren(),
		client.models.AgendaItem.agendaItemsByDate(
			{ date: dateKey },
			{ sortDirection: "ASC", limit: 1000 },
		).then(unwrap),
	]);
	return {
		date: dateKey,
		children: children.filter((c) => !c.archived),
		items,
	};
}
