export type ResourceType = "pdf" | "video" | "link" | "note";

export type Child = {
	id: string;
	name: string;
	emoji?: string;
};

// Fixed color palette indexed by child order (up to 4 children)
export const CHILD_COLORS = [
	{
		bg: "bg-pink-100",
		text: "text-pink-700",
		border: "border-pink-300",
		activeBg: "bg-pink-500",
	},
	{
		bg: "bg-sky-100",
		text: "text-sky-700",
		border: "border-sky-300",
		activeBg: "bg-sky-500",
	},
	{
		bg: "bg-amber-100",
		text: "text-amber-700",
		border: "border-amber-300",
		activeBg: "bg-amber-500",
	},
	{
		bg: "bg-violet-100",
		text: "text-violet-700",
		border: "border-violet-300",
		activeBg: "bg-violet-500",
	},
] as const;

export type Resource = {
	id: string;
	label: string;
	type: ResourceType;
	url?: string;
	description?: string;
	childIds?: string[];
	prompts?: string[];
};

export type AgendaItem = {
	id: string;
	title: string;
	emoji: string;
	iconBg: string;
	time?: string;
	description?: string;
	resources?: Resource[];
	childIds?: string[];
};

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

// Placeholder until phase 2 moves agendas into DynamoDB via Amplify Data.
export async function getAgendaForDate(dateKey: string): Promise<DayAgenda> {
	return { date: dateKey, children: [], items: [] };
}
