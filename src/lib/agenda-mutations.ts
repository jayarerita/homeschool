import {
	type ActivityDraft,
	type ActivityFields,
	fromActivityDraft,
} from "~/components/ActivityForm";
import { toResourceDrafts } from "~/components/ResourceListEditor";
import type { AgendaItem } from "./agenda";
import { client, unwrap } from "./data-client";
import { compact, planInsert, planMove } from "./planning";
import { ensureDayPlan, type Routine } from "./planning-data";

type Source = "parent" | "routine";

async function applySortOrders(changes: { id: string; sortOrder: number }[]) {
	for (const change of changes) {
		unwrap(await client.models.AgendaItem.update(change));
	}
}

async function insertItem(
	date: string,
	items: readonly AgendaItem[],
	fields: ActivityFields,
	source: Source,
	routineId?: string,
): Promise<AgendaItem> {
	const plan = planInsert(items, fields.startTime);
	await applySortOrders(plan.renumber);
	await ensureDayPlan(date);
	const created = unwrap(
		await client.models.AgendaItem.create({
			...fields,
			date,
			sortOrder: plan.sortOrder,
			status: "planned",
			source,
			routineId,
		}),
	);
	if (!created) throw new Error("Could not create the activity.");
	return created;
}

export function createAgendaItem(
	date: string,
	items: readonly AgendaItem[],
	draft: ActivityDraft,
): Promise<AgendaItem> {
	return insertItem(date, items, fromActivityDraft(draft), "parent");
}

// Changing the start time moves the item to its new place in the day.
export async function updateAgendaItem(
	item: AgendaItem,
	items: readonly AgendaItem[],
	draft: ActivityDraft,
): Promise<void> {
	const fields = fromActivityDraft(draft);
	let sortOrder = item.sortOrder;
	if (fields.startTime && fields.startTime !== item.startTime) {
		const plan = planInsert(
			items.filter((i) => i.id !== item.id),
			fields.startTime,
		);
		await applySortOrders(plan.renumber);
		sortOrder = plan.sortOrder;
	}
	unwrap(
		await client.models.AgendaItem.update({
			id: item.id,
			...fields,
			sortOrder,
		}),
	);
}

export async function deleteAgendaItem(id: string): Promise<void> {
	unwrap(await client.models.AgendaItem.delete({ id }));
}

export function moveAgendaItem(
	items: readonly AgendaItem[],
	index: number,
	delta: -1 | 1,
): Promise<void> {
	return applySortOrders(planMove(items, index, delta));
}

// Adds routines to a day one at a time, each placed by its start time.
export async function applyRoutines(
	date: string,
	items: readonly AgendaItem[],
	routines: readonly Routine[],
): Promise<void> {
	let current = [...items];
	for (const routine of routines) {
		const created = await insertItem(
			date,
			current,
			{
				title: routine.title,
				emoji: routine.emoji ?? null,
				color: routine.color ?? null,
				startTime: routine.startTime ?? null,
				endTime: routine.endTime ?? null,
				description: routine.description ?? null,
				childIds: compact(routine.childIds).length
					? compact(routine.childIds)
					: null,
				// Each day gets its own copy of the resource entries.
				resources: toResourceDrafts(routine.resources).map((r) => ({
					...r,
					id: crypto.randomUUID(),
				})),
			},
			"routine",
			routine.id,
		);
		current = [...current, created];
	}
}
