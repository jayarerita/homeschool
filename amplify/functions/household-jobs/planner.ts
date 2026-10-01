import { pendingRoutines, planInsert } from "../../../src/lib/planning";
import { DRAFT_FAILED_PREFIX } from "../../data/day-plan";
import type { Schema } from "../../data/resource";
import { replyText, runAgent } from "../tutor-core/agent";
import {
	buildContext,
	describeDate,
	loadHousehold,
} from "../tutor-core/context";
import { type DataClient, unwrap } from "../tutor-core/data";
import { describeModelError } from "../tutor-core/model";
import type { Settings } from "./schedule";

type AgendaItem = Schema["AgendaItem"]["type"];

async function itemsOn(
	client: DataClient,
	date: string,
): Promise<AgendaItem[]> {
	return unwrap(
		await client.models.AgendaItem.agendaItemsByDate(
			{ date },
			{ sortDirection: "ASC", limit: 1000 },
		),
	);
}

// Adds the day's scheduled routines (the same thing the "Add" banner does in
// the app), so the model plans around them.
async function addRoutines(client: DataClient, date: string): Promise<void> {
	const routines = unwrap(await client.models.Routine.list({ limit: 1000 }));
	let items = await itemsOn(client, date);
	for (const routine of pendingRoutines(routines, date, items)) {
		const plan = planInsert(items, routine.startTime);
		for (const change of plan.renumber) {
			unwrap(await client.models.AgendaItem.update(change));
		}
		const created = unwrap(
			await client.models.AgendaItem.create({
				date,
				sortOrder: plan.sortOrder,
				title: routine.title,
				emoji: routine.emoji,
				color: routine.color,
				startTime: routine.startTime,
				endTime: routine.endTime,
				description: routine.description,
				childIds: routine.childIds,
				resources: (routine.resources ?? [])
					.filter((r) => !!r)
					.map((r) => ({ ...r, id: crypto.randomUUID() })),
				status: "planned",
				source: "routine",
				routineId: routine.id,
			}),
		);
		if (created) items = [...items, created];
	}
}

function instructions(date: string): string {
	return `Please draft the plan for ${describeDate(date)} (${date}). The parents will review it before it's final.

The day's routines are already on it. Around them, add a small number of focused learning activities that suit each child's age and stage: reinforce the learning units that are running, draw on each child's profile and recent observations, and avoid repeating what they did in the last few days (check the surrounding days with get_agenda). Give each activity a clear description the parent can run without extra prep, and list the materials needed. Don't remove or change what's already planned.

When you're done, reply with one or two sentences for the parents' notification: what the day focuses on and anything they need to prepare or double-check. Don't ask questions - make sensible choices and mention anything worth checking.`;
}

// Drafts one day with the tutor. Returns the summary for the notification, or
// null if the day already had a plan (unless `force`, used when a parent asks
// for a draft from the app).
export async function draftDay(
	client: DataClient,
	settings: Settings,
	date: string,
	now: Date,
	{ force = false }: { force?: boolean } = {},
): Promise<string | null> {
	const existing = unwrap(await client.models.DayPlan.get({ date }));
	if (existing && !force) return null;
	if (existing) {
		unwrap(await client.models.DayPlan.update({ date, summary: null }));
	} else {
		unwrap(await client.models.DayPlan.create({ date, status: "draft" }));
	}

	let summary: string;
	try {
		await addRoutines(client, date);
		const household = await loadHousehold(client);
		const context = await buildContext({
			client,
			household,
			audience: { kind: "planner" },
			now,
			timeZone: settings.timeZone,
			focusDate: date,
		});
		const turn: Parameters<typeof runAgent>[0]["turn"] = [
			{ role: "user", content: [{ type: "text", text: instructions(date) }] },
			{ role: "system", content: context },
		];
		const outcome = await runAgent({
			turn,
			toolContext: { client, household, today: date, activity: [] },
		});
		summary =
			outcome === "refused"
				? "The tutor couldn't draft this day. Add activities yourself or ask the tutor in chat."
				: replyText(turn).split("\n\n").at(-1)?.trim() ||
					"A draft plan is ready.";
	} catch (e) {
		// Record the failure so the app stops showing "drafting" and can offer a
		// retry; the scheduled run logs it and moves on.
		await client.models.DayPlan.update({
			date,
			summary: `${DRAFT_FAILED_PREFIX}${describeModelError(e)}`,
		});
		throw e;
	}

	// The summary also tells the app the draft has finished.
	unwrap(await client.models.DayPlan.update({ date, summary }));
	return summary;
}
