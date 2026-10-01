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

export type Engagement = "low" | "medium" | "high";

// A parent's quick note on how an activity went: one observation per child it
// was for (everyone, if it wasn't assigned), and the activity marked done.
export async function recordFeedback(
	item: AgendaItem,
	childIds: string[],
	engagement: Engagement,
	note: string,
	author: string,
): Promise<void> {
	const text = note.trim() || `Engagement was ${engagement}.`;
	for (const childId of childIds) {
		unwrap(
			await client.models.Observation.create({
				childId,
				date: item.date,
				agendaItemId: item.id,
				note: `${item.title}: ${text}`,
				engagement,
				recordedBy: author,
			}),
		);
	}
	unwrap(
		await client.models.AgendaItem.update({ id: item.id, status: "done" }),
	);
}

// Asks the planner to draft (or add to) a day in the background. The day's
// DayPlan.summary is cleared, then set again when the draft is finished.
export async function requestDraft(date: string): Promise<void> {
	// Clear a previous result (e.g. a failed draft) so the app shows the new
	// draft as in progress straight away.
	const existing = unwrap(await client.models.DayPlan.get({ date }));
	if (existing?.summary) {
		unwrap(await client.models.DayPlan.update({ date, summary: null }));
	}
	unwrap(await client.mutations.draftDay({ date }));
}

export async function publishDay(date: string): Promise<void> {
	unwrap(await client.models.DayPlan.update({ date, status: "published" }));
}

// Removes the tutor's suggested activities from a draft day and keeps
// everything else (routines, parents' own additions).
export async function discardDraft(
	date: string,
	items: readonly AgendaItem[],
): Promise<void> {
	for (const item of items.filter((i) => i.source === "agent")) {
		unwrap(await client.models.AgendaItem.delete({ id: item.id }));
	}
	unwrap(
		await client.models.DayPlan.update({
			date,
			status: "published",
			summary: null,
		}),
	);
}
