import type { Schema } from "../../data/resource";
import { describeDate } from "../tutor-core/context";
import { type DataClient, unwrap } from "../tutor-core/data";
import { createNotification } from "./notify";
import { draftDay } from "./planner";
import {
	addDays,
	type LocalClock,
	listPhrase,
	materialsFor,
	needsFeedback,
	type Settings,
} from "./schedule";

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

const shortDate = (date: string) => describeDate(date).replace(/, \d{4}$/, "");

export async function planUpcomingDays(
	client: DataClient,
	settings: Settings,
	dates: string[],
	now: Date,
): Promise<void> {
	for (const date of dates) {
		const summary = await draftDay(client, settings, date, now);
		if (summary === null) continue; // already planned
		await createNotification(client, {
			type: "plan_ready",
			title: `Draft plan for ${shortDate(date)} is ready`,
			body: summary,
			url: `/?date=${date}`,
			dedupeKey: `plan_ready:${date}`,
		});
	}
}

export async function materialsReminder(
	client: DataClient,
	settings: Settings,
	date: string,
): Promise<void> {
	const items = await itemsOn(client, date);
	if (items.length === 0) {
		// With the planner off, a heads-up that tomorrow is empty.
		if (!settings.plannerEnabled) {
			await createNotification(client, {
				type: "plan_ready",
				title: "Nothing planned for tomorrow yet",
				body: "Add activities, or ask the tutor to draft the day.",
				url: `/?date=${date}`,
				dedupeKey: `unplanned:${date}`,
			});
		}
		return;
	}
	const materials = materialsFor(items);
	if (materials.length === 0) return;
	await createNotification(client, {
		type: "materials",
		title: "Materials for tomorrow",
		body: materials.map((m) => `${m.label} (${m.for.join(", ")})`).join("; "),
		url: `/?date=${date}`,
		dedupeKey: `materials:${date}`,
	});
}

export async function feedbackRequest(
	client: DataClient,
	date: string,
	clock: LocalClock,
): Promise<void> {
	const [items, observations] = await Promise.all([
		itemsOn(client, date),
		client.models.Observation.list({
			filter: { date: { eq: date } },
			limit: 1000,
		}).then(unwrap),
	]);
	const observed = new Set(
		observations.map((o) => o.agendaItemId).filter((id): id is string => !!id),
	);
	const nowHHmm = `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
	const pending = needsFeedback(items, observed, nowHHmm);
	if (pending.length === 0) return;
	const titles = pending.slice(0, 3).map((i) => i.title);
	if (pending.length > 3) titles.push(`${pending.length - 3} more`);
	await createNotification(client, {
		type: "feedback",
		title: "How did today go?",
		body: `A quick note on ${listPhrase(titles)} helps the tutor plan what's next.`,
		url: `/?date=${date}&feedback=true`,
		dedupeKey: `feedback:${date}`,
	});
}

export async function weeklyPreview(
	client: DataClient,
	weekStart: string,
): Promise<void> {
	const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
	const weekEnd = dates[6];
	const [days, units] = await Promise.all([
		Promise.all(dates.map((d) => itemsOn(client, d))),
		client.models.LearningUnit.list({ limit: 1000 }).then(unwrap),
	]);
	const planned = days.filter((items) => items.length > 0).length;
	const materials = materialsFor(days.flat());
	const running = units
		.filter((u) => u.startDate <= weekEnd && u.endDate >= weekStart)
		.map((u) => (u.source ? `${u.source}: ${u.title}` : u.title));

	const parts = [
		`${planned} of 7 days planned.`,
		running.length > 0 && `This week: ${listPhrase(running)}.`,
		materials.length > 0 &&
			`${materials.length} material${materials.length === 1 ? "" : "s"} to gather: ${materials
				.slice(0, 6)
				.map((m) => m.label)
				.join(", ")}${materials.length > 6 ? ", …" : ""}.`,
	].filter(Boolean);
	await createNotification(client, {
		type: "weekly_preview",
		title: "Your week ahead",
		body: parts.join(" "),
		url: `/?date=${weekStart}`,
		dedupeKey: `weekly:${weekStart}`,
	});
}
