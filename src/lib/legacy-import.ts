// Converts day files from the pre-cloud app (one `YYYY-MM-DD.json` per day)
// into Amplify Data records. Pure functions only; see legacy-import-runner.ts
// for the part that writes to the backend.
import { COLOR_TOKENS, type ColorToken } from "./colors";

export type LegacyChild = { id: string; name: string; emoji?: string };

export type LegacyResource = {
	id?: string;
	label: string;
	type?: string;
	url?: string;
	description?: string;
	childIds?: string[];
	prompts?: string[];
};

export type LegacyItem = {
	id?: string;
	title: string;
	emoji?: string;
	iconBg?: string;
	time?: string;
	description?: string;
	childIds?: string[];
	resources?: LegacyResource[];
};

export type LegacyDay = {
	date: string;
	children: LegacyChild[];
	items: LegacyItem[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RESOURCE_TYPES = ["pdf", "video", "link", "note"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Validates the shape of one day file. The date comes from the file's `date`
// field, falling back to a `YYYY-MM-DD.json` file name.
export function parseLegacyDay(json: unknown, fileName?: string): LegacyDay {
	if (!isObject(json)) throw new Error("Not a JSON object.");
	const fromName = fileName?.replace(/\.json$/i, "");
	const date =
		typeof json.date === "string" && DATE_RE.test(json.date)
			? json.date
			: fromName && DATE_RE.test(fromName)
				? fromName
				: undefined;
	if (!date) throw new Error("Missing a YYYY-MM-DD date.");

	const children = Array.isArray(json.children)
		? json.children.filter(
				(c): c is LegacyChild =>
					isObject(c) && typeof c.id === "string" && typeof c.name === "string",
			)
		: [];
	const items = Array.isArray(json.items)
		? json.items.filter(
				(i): i is LegacyItem => isObject(i) && typeof i.title === "string",
			)
		: [];
	return { date, children, items };
}

// "7:30 AM" -> "07:30"
export function parseClockTime(text: string): string | undefined {
	const m = text.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
	if (!m) return undefined;
	let hour = Number(m[1]) % 12;
	if (m[3].toLowerCase() === "p") hour += 12;
	return `${String(hour).padStart(2, "0")}:${m[2]}`;
}

// "7:30 AM – 7:45 AM" -> { startTime: "07:30", endTime: "07:45" }
export function parseTimeRange(text: string | undefined): {
	startTime?: string;
	endTime?: string;
} {
	if (!text) return {};
	const [start, end] = text.split(/\s*[–—-]\s*/);
	return {
		startTime: parseClockTime(start ?? ""),
		endTime: end ? parseClockTime(end) : undefined,
	};
}

// "bg-yellow-100" -> "yellow"
export function colorFromIconBg(
	iconBg: string | undefined,
): ColorToken | undefined {
	const token = iconBg?.match(/^bg-([a-z]+)-\d+$/)?.[1];
	return (COLOR_TOKENS as readonly string[]).includes(token ?? "")
		? (token as ColorToken)
		: undefined;
}

// The old app used "#" as a placeholder; the backend only accepts real URLs.
export function safeUrl(url: string | undefined): string | undefined {
	return url && /^https?:\/\/\S+$/i.test(url) ? url : undefined;
}

export type LegacyChildGroup = {
	name: string;
	emoji?: string;
	legacyIds: string[];
};

// Children across all files, merged by name (case-insensitive).
export function collectLegacyChildren(days: LegacyDay[]): LegacyChildGroup[] {
	const byName = new Map<string, LegacyChildGroup>();
	for (const child of days.flatMap((d) => d.children)) {
		const key = child.name.trim().toLowerCase();
		const group = byName.get(key) ?? {
			name: child.name.trim(),
			emoji: child.emoji,
			legacyIds: [],
		};
		if (!group.legacyIds.includes(child.id)) group.legacyIds.push(child.id);
		group.emoji ??= child.emoji;
		byName.set(key, group);
	}
	return [...byName.values()];
}

export type ImportedResource = {
	id: string;
	label: string;
	type: ResourceType;
	url?: string;
	description?: string;
	childIds?: string[];
	prompts?: string[];
};

export type ImportedAgendaItem = {
	date: string;
	sortOrder: number;
	startTime?: string;
	endTime?: string;
	title: string;
	emoji?: string;
	color?: ColorToken;
	description?: string;
	childIds?: string[];
	resources?: ImportedResource[];
	status: "planned";
	source: "import";
};

function mapChildIds(
	ids: string[] | undefined,
	childIdMap: ReadonlyMap<string, string>,
): string[] | undefined {
	const mapped = (ids ?? []).flatMap((id) => {
		const newId = childIdMap.get(id);
		return newId ? [newId] : [];
	});
	return mapped.length > 0 ? mapped : undefined;
}

// Items keep their file order; sortOrder leaves gaps so items can be inserted
// between them later.
export function toAgendaItems(
	day: LegacyDay,
	childIdMap: ReadonlyMap<string, string>,
): ImportedAgendaItem[] {
	return day.items.map((item, index) => ({
		date: day.date,
		sortOrder: (index + 1) * 10,
		...parseTimeRange(item.time),
		title: item.title,
		emoji: item.emoji,
		color: colorFromIconBg(item.iconBg),
		description: item.description,
		childIds: mapChildIds(item.childIds, childIdMap),
		resources: item.resources?.map((r, i) => ({
			id: r.id ?? `${item.id ?? index}-r${i + 1}`,
			label: r.label,
			type: (RESOURCE_TYPES as readonly string[]).includes(r.type ?? "")
				? (r.type as ResourceType)
				: "note",
			url: safeUrl(r.url),
			description: r.description,
			childIds: mapChildIds(r.childIds, childIdMap),
			prompts: r.prompts,
		})),
		status: "planned",
		source: "import",
	}));
}
