import { client, type Schema, unwrap } from "./data-client";

export type LibraryResource = Schema["LibraryResource"]["type"];
export type Routine = Schema["Routine"]["type"];
export type LearningUnit = Schema["LearningUnit"]["type"];
export type Attachment = Schema["Attachment"]["type"];
export type ResourceKind = NonNullable<Schema["ResourceRef"]["type"]["type"]>;

export const RESOURCE_KINDS: { value: ResourceKind; label: string }[] = [
	{ value: "link", label: "Link" },
	{ value: "video", label: "Video" },
	{ value: "pdf", label: "PDF / worksheet" },
	{ value: "book", label: "Book" },
	{ value: "material", label: "Materials" },
	{ value: "note", label: "Note" },
];

export async function listLibrary(): Promise<LibraryResource[]> {
	const resources = unwrap(
		await client.models.LibraryResource.list({ limit: 1000 }),
	);
	return resources.sort((a, b) => a.label.localeCompare(b.label));
}

export async function listRoutines(): Promise<Routine[]> {
	const routines = unwrap(await client.models.Routine.list({ limit: 1000 }));
	return routines.sort(
		(a, b) =>
			(a.startTime ?? "99").localeCompare(b.startTime ?? "99") ||
			a.title.localeCompare(b.title),
	);
}

export async function listLearningUnits(): Promise<LearningUnit[]> {
	const units = unwrap(await client.models.LearningUnit.list({ limit: 1000 }));
	return units.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

// Days created by hand get a DayPlan too, so imports and the planner know the
// day already has a plan.
export async function ensureDayPlan(date: string): Promise<void> {
	const existing = unwrap(await client.models.DayPlan.get({ date }));
	if (!existing) {
		unwrap(await client.models.DayPlan.create({ date, status: "published" }));
	}
}
