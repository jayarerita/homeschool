import type { Schema } from "../../data/resource";
import { type DataClient, unwrap } from "./data";

type Child = Schema["Child"]["type"];
type AgendaItem = Schema["AgendaItem"]["type"];
type LearningUnit = Schema["LearningUnit"]["type"];
type Conversation = Schema["Conversation"]["type"];

// ── Dates in the household's time zone (the Lambda itself runs in UTC) ──

export function localDateKey(now: Date, timeZone: string): string {
	// en-CA formats as YYYY-MM-DD.
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
}

export function addDays(dateKey: string, days: number): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function describeDate(dateKey: string): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
		timeZone: "UTC",
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

export function ageOn(birthdate: string, dateKey: string): number {
	const [by, bm, bd] = birthdate.split("-").map(Number);
	const [y, m, d] = dateKey.split("-").map(Number);
	return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function isValidTimeZone(timeZone: string | null | undefined): boolean {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
}

const compact = <T>(
	values: readonly (T | null | undefined)[] | null | undefined,
) => (values ?? []).filter((v): v is T => v !== null && v !== undefined);

// ── Household data shared by the context message and the tools ──

export type Household = {
	children: Child[];
	childName: (id: string) => string;
};

export async function loadHousehold(client: DataClient): Promise<Household> {
	const children = unwrap(await client.models.Child.list({ limit: 1000 }))
		.filter((c) => !c.archived)
		.sort((a, b) => a.sortOrder - b.sortOrder);
	const names = new Map(children.map((c) => [c.id, c.name]));
	return { children, childName: (id) => names.get(id) ?? "(unknown child)" };
}

export function describeItem(item: AgendaItem, household: Household): string {
	const time = item.startTime
		? `${item.startTime}${item.endTime ? `–${item.endTime}` : ""} `
		: "";
	const kids = compact(item.childIds).map(household.childName);
	const status =
		item.status && item.status !== "planned" ? ` [${item.status}]` : "";
	return `${time}${item.emoji ?? ""} ${item.title}${kids.length ? ` (for ${kids.join(", ")})` : ""}${status} {id: ${item.id}}`.replace(
		/\s+/g,
		" ",
	);
}

// ── The per-turn context message ──

// Who the tutor is working for in this turn.
export type Audience =
	| { kind: "parent"; name: string }
	| {
			kind: "lesson";
			parentName: string;
			childId: string | null | undefined;
			agendaItemId: string | null | undefined;
	  }
	| { kind: "planner" };

export function audienceFor(
	conversation: Conversation,
	authorName: string,
): Audience {
	return conversation.mode === "lesson"
		? {
				kind: "lesson",
				parentName: authorName,
				childId: conversation.childId,
				agendaItemId: conversation.agendaItemId,
			}
		: { kind: "parent", name: authorName };
}

export async function buildContext({
	client,
	household,
	audience,
	now,
	timeZone,
	focusDate,
}: {
	client: DataClient;
	household: Household;
	audience: Audience;
	now: Date;
	timeZone: string;
	// The day whose plan is shown in full; defaults to today.
	focusDate?: string;
}): Promise<string> {
	const today = localDateKey(now, timeZone);
	const day = focusDate ?? today;
	const time = now.toLocaleTimeString("en-US", {
		timeZone,
		hour: "numeric",
		minute: "2-digit",
	});

	const [profiles, units, dayItems, observations] = await Promise.all([
		client.models.LearnerProfile.list({ limit: 1000 }).then(unwrap),
		client.models.LearningUnit.list({ limit: 1000 }).then(unwrap),
		client.models.AgendaItem.agendaItemsByDate(
			{ date: day },
			{ sortDirection: "ASC", limit: 1000 },
		).then(unwrap),
		Promise.all(
			household.children.map((c) =>
				client.models.Observation.observationsByChild(
					{ childId: c.id },
					{ sortDirection: "DESC", limit: 5 },
				).then(unwrap),
			),
		),
	]);
	const profileFor = new Map(profiles.map((p) => [p.childId, p.notes]));

	const lines: string[] = [
		"<household_context>",
		`Today is ${describeDate(today)} (${today}). Local time: ${time} (${timeZone}).`,
	];

	if (audience.kind === "lesson") {
		const child = household.children.find((c) => c.id === audience.childId);
		lines.push(
			`This is a lesson conversation: you are speaking directly with ${child?.name ?? "a child"}, with ${audience.parentName} (a parent) nearby.`,
		);
		if (audience.agendaItemId) {
			const item = unwrap(
				await client.models.AgendaItem.get({ id: audience.agendaItemId }),
			);
			if (item) {
				lines.push(
					"",
					"## The activity",
					describeItem(item, household),
					item.description ?? "",
					...compact(item.resources).map(
						(r) =>
							`- Resource: ${r.label} (${r.type ?? "note"})${r.description ? ` — ${r.description}` : ""}${r.url ? ` ${r.url}` : ""}${r.s3Key ? ` [file: ${r.s3Key}]` : ""}`,
					),
				);
			}
		}
	} else if (audience.kind === "parent") {
		lines.push(`You're talking with ${audience.name}, a parent.`);
	} else {
		lines.push(
			"No one is chatting: you are the household's planner, running on a schedule. Your final reply becomes a short notification to the parents.",
		);
	}

	lines.push("", "## Children");
	if (household.children.length === 0) {
		lines.push(
			"No children have been added yet. Parents add them in Settings → Children.",
		);
	}
	household.children.forEach((child, index) => {
		const facts = [
			child.birthdate &&
				`age ${ageOn(child.birthdate, today)} (born ${child.birthdate})`,
			child.gradeLevel,
			compact(child.interests).length &&
				`interests: ${compact(child.interests).join(", ")}`,
		].filter(Boolean);
		lines.push(
			`### ${child.emoji ?? ""} ${child.name} {id: ${child.id}}`.replace(
				/\s+/g,
				" ",
			),
			facts.join("; ") || "No details yet.",
		);
		if (child.notes) lines.push(`Parent notes: ${child.notes}`);
		const profile = profileFor.get(child.id);
		lines.push(
			`Your learner profile: ${profile?.trim() || "(empty — start one as you learn about them)"}`,
		);
		const recent = observations[index] ?? [];
		if (recent.length > 0) {
			lines.push("Recent observations:");
			for (const o of recent) {
				lines.push(
					`- ${o.date}${o.engagement ? ` (engagement: ${o.engagement})` : ""}: ${o.note}`,
				);
			}
		}
	});

	// Units running now or starting in the next two weeks.
	const horizon = addDays(today, 14);
	const relevant = units
		.filter((u) => u.endDate >= today && u.startDate <= horizon)
		.sort((a, b) => a.startDate.localeCompare(b.startDate));
	lines.push("", "## Learning units (now and next two weeks)");
	if (relevant.length === 0) lines.push("None recorded.");
	for (const unit of relevant as LearningUnit[]) {
		const kids = compact(unit.childIds).map(household.childName);
		lines.push(
			`- ${unit.source ? `${unit.source}: ` : ""}${unit.title}, ${unit.startDate} to ${unit.endDate}${kids.length ? ` (for ${kids.join(", ")})` : ""}${compact(unit.topics).length ? `. Topics: ${compact(unit.topics).join(", ")}` : ""}${unit.notes ? `. Notes: ${unit.notes}` : ""}${compact(
				unit.attachments,
			)
				.map((a) => ` [file "${a.name}": ${a.s3Key}]`)
				.join("")}`,
		);
	}

	lines.push(
		"",
		day === today
			? "## Today's plan"
			: `## Plan for ${describeDate(day)} (${day})`,
	);
	if (dayItems.length === 0) lines.push("Nothing planned yet.");
	for (const item of dayItems) lines.push(`- ${describeItem(item, household)}`);

	lines.push("</household_context>");
	return lines.join("\n");
}
