import { listChildren } from "./agenda";
import { nextUnusedColor } from "./colors";
import { client, unwrap } from "./data-client";
import {
	collectLegacyChildren,
	type LegacyDay,
	toAgendaItems,
} from "./legacy-import";

export type ImportResult = {
	imported: string[];
	skipped: string[];
	childrenCreated: string[];
};

// Imports legacy days. Children are matched to existing ones by name and
// created otherwise. Days that already have a DayPlan are skipped, so the
// import can be rerun safely; a day's DayPlan is written last, and any items
// left over from an interrupted import of that day are cleared first.
export async function importLegacyDays(
	days: LegacyDay[],
	onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
	const result: ImportResult = {
		imported: [],
		skipped: [],
		childrenCreated: [],
	};

	const existing = await listChildren();
	const usedColors = existing.map((c) => c.color);
	let nextSortOrder = Math.max(0, ...existing.map((c) => c.sortOrder)) + 1;
	const childIdMap = new Map<string, string>();

	for (const legacy of collectLegacyChildren(days)) {
		let child = existing.find(
			(c) => c.name.trim().toLowerCase() === legacy.name.toLowerCase(),
		);
		if (!child) {
			const color = nextUnusedColor(usedColors);
			const created = unwrap(
				await client.models.Child.create({
					name: legacy.name,
					emoji: legacy.emoji,
					color,
					sortOrder: nextSortOrder++,
				}),
			);
			if (!created) throw new Error(`Could not create child ${legacy.name}.`);
			child = created;
			usedColors.push(color);
			result.childrenCreated.push(legacy.name);
		}
		for (const id of legacy.legacyIds) childIdMap.set(id, child.id);
	}

	const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
	for (const [index, day] of sorted.entries()) {
		const plan = unwrap(await client.models.DayPlan.get({ date: day.date }));
		if (plan) {
			result.skipped.push(day.date);
		} else {
			const leftovers = unwrap(
				await client.models.AgendaItem.agendaItemsByDate({ date: day.date }),
			);
			for (const item of leftovers.filter((i) => i.source === "import")) {
				unwrap(await client.models.AgendaItem.delete({ id: item.id }));
			}
			for (const item of toAgendaItems(day, childIdMap)) {
				unwrap(await client.models.AgendaItem.create(item));
			}
			unwrap(
				await client.models.DayPlan.create({
					date: day.date,
					status: "published",
				}),
			);
			result.imported.push(day.date);
		}
		onProgress?.(index + 1, sorted.length);
	}

	return result;
}
