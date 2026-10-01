import type Anthropic from "@anthropic-ai/sdk";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { planInsert } from "../../../src/lib/planning";
import { COLOR_TOKENS } from "../../data/colors";
import type { Schema } from "../../data/resource";
import { addDays, describeDate, describeItem, type Household } from "./context";
import { type DataClient, unwrap } from "./data";

type AgendaItem = Schema["AgendaItem"]["type"];
type ToolResultContent = Anthropic.Beta.BetaToolResultBlockParam["content"];

export type ToolContext = {
	client: DataClient;
	household: Household;
	today: string;
	// Short, parent-facing summaries of changes, shown under the reply.
	activity: string[];
};

const s3 = new S3Client();

// ── Shared schemas ──

const dateKey = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.describe("Date as YYYY-MM-DD");
const clock = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
	.describe("24-hour time as HH:mm");
const resourceType = z.enum([
	"link",
	"video",
	"pdf",
	"note",
	"book",
	"material",
]);
const resourceInput = z.object({
	label: z.string().min(1),
	type: resourceType.describe(
		'"material" for physical supplies to gather; "book", "video", "link", "pdf" (worksheet) or "note" (instructions/tips)',
	),
	url: z.url().optional().describe("Only a real, known URL - never invent one"),
	description: z.string().optional(),
	child_ids: z.array(z.string()).optional(),
});
const itemFields = {
	title: z.string().min(1),
	start_time: clock.optional(),
	end_time: clock.optional(),
	emoji: z.string().optional(),
	color: z.enum(COLOR_TOKENS).optional().describe("Card color"),
	description: z
		.string()
		.optional()
		.describe("What to do, written for the parent running it"),
	child_ids: z
		.array(z.string())
		.optional()
		.describe("Children this is for; omit for everyone"),
	resources: z.array(resourceInput).optional(),
};

// ── Helpers ──

function toResources(resources: z.infer<typeof resourceInput>[] | undefined) {
	return resources?.map((r) => ({
		id: crypto.randomUUID(),
		label: r.label,
		type: r.type,
		url: r.url ?? null,
		description: r.description ?? null,
		childIds: r.child_ids?.length ? r.child_ids : null,
	}));
}

function shortDate(date: string): string {
	return describeDate(date).replace(/, \d{4}$/, "");
}

function assertKnownChildren(household: Household, ids: string[] | undefined) {
	const unknown = (ids ?? []).filter(
		(id) => !household.children.some((c) => c.id === id),
	);
	if (unknown.length > 0)
		throw new Error(`Unknown child id(s): ${unknown.join(", ")}`);
}

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

async function applySortOrders(
	client: DataClient,
	changes: { id: string; sortOrder: number }[],
) {
	for (const change of changes) {
		unwrap(await client.models.AgendaItem.update(change));
	}
}

async function ensureDayPlan(client: DataClient, date: string) {
	if (!unwrap(await client.models.DayPlan.get({ date }))) {
		unwrap(await client.models.DayPlan.create({ date, status: "published" }));
	}
}

// ── Tools ──

type Tool<S extends z.ZodType> = {
	name: string;
	description: string;
	input: S;
	run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResultContent>;
};

function tool<S extends z.ZodType>(definition: Tool<S>): Tool<S> {
	return definition;
}

const TOOLS = [
	tool({
		name: "get_agenda",
		description:
			"Read the planned activities for a date range (at most 14 days). Returns each day's items in order with ids, times, children, descriptions and resources.",
		input: z.object({
			start_date: dateKey,
			end_date: dateKey
				.optional()
				.describe("Inclusive; defaults to start_date"),
		}),
		async run({ start_date, end_date }, { client, household }) {
			const end = end_date ?? start_date;
			if (end < start_date) throw new Error("end_date is before start_date");
			if (end > addDays(start_date, 13))
				throw new Error("At most 14 days at a time");
			const days = [];
			for (let date = start_date; date <= end; date = addDays(date, 1)) {
				const items = await itemsOn(client, date);
				days.push({
					date,
					day: describeDate(date),
					items: items.map((item) => ({
						id: item.id,
						summary: describeItem(item, household),
						description: item.description ?? undefined,
						resources: (item.resources ?? [])
							.filter((r) => !!r)
							.map((r) => ({
								label: r.label,
								type: r.type,
								description: r.description ?? undefined,
								url: r.url ?? undefined,
								file: r.s3Key ?? undefined,
							})),
					})),
				});
			}
			return JSON.stringify(days);
		},
	}),

	tool({
		name: "add_agenda_item",
		description:
			"Add an activity to a day. It is placed in time order among the day's existing items.",
		input: z.object({ date: dateKey, ...itemFields }),
		async run(input, { client, household, activity }) {
			assertKnownChildren(household, input.child_ids);
			const items = await itemsOn(client, input.date);
			const plan = planInsert(items, input.start_time);
			await applySortOrders(client, plan.renumber);
			await ensureDayPlan(client, input.date);
			const created = unwrap(
				await client.models.AgendaItem.create({
					date: input.date,
					sortOrder: plan.sortOrder,
					title: input.title,
					startTime: input.start_time ?? null,
					endTime: input.end_time ?? null,
					emoji: input.emoji ?? null,
					color: input.color ?? null,
					description: input.description ?? null,
					childIds: input.child_ids?.length ? input.child_ids : null,
					resources: toResources(input.resources) ?? null,
					status: "planned",
					source: "agent",
				}),
			);
			if (!created) throw new Error("The activity could not be created");
			activity.push(`Added “${input.title}” on ${shortDate(input.date)}`);
			return JSON.stringify({ id: created.id, sortOrder: created.sortOrder });
		},
	}),

	tool({
		name: "update_agenda_item",
		description:
			"Change an existing activity. Only the fields you pass change; resources, if passed, replace the whole list. Use status to mark it done or skipped.",
		input: z
			.object(itemFields)
			.partial()
			.extend({
				id: z.string(),
				status: z.enum(["planned", "done", "skipped"]).optional(),
			}),
		async run(input, { client, household, activity }) {
			assertKnownChildren(household, input.child_ids);
			const item = unwrap(await client.models.AgendaItem.get({ id: input.id }));
			if (!item) throw new Error(`No activity with id ${input.id}`);
			let sortOrder = item.sortOrder;
			if (input.start_time && input.start_time !== item.startTime) {
				const others = (await itemsOn(client, item.date)).filter(
					(i) => i.id !== item.id,
				);
				const plan = planInsert(others, input.start_time);
				await applySortOrders(client, plan.renumber);
				sortOrder = plan.sortOrder;
			}
			unwrap(
				await client.models.AgendaItem.update({
					id: item.id,
					sortOrder,
					...(input.title !== undefined && { title: input.title }),
					...(input.start_time !== undefined && {
						startTime: input.start_time,
					}),
					...(input.end_time !== undefined && { endTime: input.end_time }),
					...(input.emoji !== undefined && { emoji: input.emoji }),
					...(input.color !== undefined && { color: input.color }),
					...(input.description !== undefined && {
						description: input.description,
					}),
					...(input.child_ids !== undefined && {
						childIds: input.child_ids.length ? input.child_ids : null,
					}),
					...(input.resources !== undefined && {
						resources: toResources(input.resources),
					}),
					...(input.status !== undefined && { status: input.status }),
				}),
			);
			const onlyStatus = Object.keys(input).every(
				(k) => k === "id" || k === "status",
			);
			activity.push(
				input.status && onlyStatus
					? `Marked “${item.title}” ${input.status}`
					: `Updated “${input.title ?? item.title}” on ${shortDate(item.date)}`,
			);
			return "Updated.";
		},
	}),

	tool({
		name: "delete_agenda_item",
		description:
			"Remove an activity from the plan. Confirm with the parent first unless they asked for this removal.",
		input: z.object({ id: z.string() }),
		async run({ id }, { client, activity }) {
			const item = unwrap(await client.models.AgendaItem.get({ id }));
			if (!item) throw new Error(`No activity with id ${id}`);
			unwrap(await client.models.AgendaItem.delete({ id }));
			activity.push(`Removed “${item.title}” from ${shortDate(item.date)}`);
			return "Deleted.";
		},
	}),

	tool({
		name: "list_routines",
		description:
			"List the household's recurring routines (days of week use 0 = Sunday … 6 = Saturday).",
		input: z.object({}),
		async run(_input, { client, household }) {
			const routines = unwrap(
				await client.models.Routine.list({ limit: 1000 }),
			);
			return JSON.stringify(
				routines.map((r) => ({
					title: r.title,
					time: r.startTime ? `${r.startTime}–${r.endTime ?? ""}` : undefined,
					days: r.daysOfWeek,
					active: r.active !== false,
					for: (r.childIds ?? [])
						.filter((id) => !!id)
						.map((id) => household.childName(id as string)),
					description: r.description ?? undefined,
				})),
			);
		},
	}),

	tool({
		name: "list_learning_units",
		description:
			"List learning units (what a child covers at preschool/school) overlapping a date range, including attached files.",
		input: z.object({ start_date: dateKey, end_date: dateKey }),
		async run({ start_date, end_date }, { client, household }) {
			const units = unwrap(
				await client.models.LearningUnit.list({ limit: 1000 }),
			);
			return JSON.stringify(
				units
					.filter((u) => u.endDate >= start_date && u.startDate <= end_date)
					.map((u) => ({
						title: u.title,
						source: u.source ?? undefined,
						start: u.startDate,
						end: u.endDate,
						for: (u.childIds ?? [])
							.filter((id) => !!id)
							.map((id) => household.childName(id as string)),
						topics: u.topics ?? undefined,
						notes: u.notes ?? undefined,
						files: (u.attachments ?? [])
							.filter((a) => !!a)
							.map((a) => ({ name: a?.name, key: a?.s3Key })),
					})),
			);
		},
	}),

	tool({
		name: "search_library",
		description:
			"Search the family's resource library by text (label, description, tags) and/or type.",
		input: z.object({
			query: z.string().optional(),
			type: resourceType.optional(),
		}),
		async run({ query, type }, { client }) {
			const needle = query?.trim().toLowerCase();
			const all = unwrap(
				await client.models.LibraryResource.list({ limit: 1000 }),
			);
			const matches = all.filter(
				(r) =>
					(!type || r.type === type) &&
					(!needle ||
						[r.label, r.description, ...(r.tags ?? [])].some((t) =>
							t?.toLowerCase().includes(needle),
						)),
			);
			return JSON.stringify(
				matches.slice(0, 50).map((r) => ({
					label: r.label,
					type: r.type,
					url: r.url ?? undefined,
					file: r.s3Key ?? undefined,
					description: r.description ?? undefined,
					tags: r.tags ?? undefined,
					ages:
						r.minAge != null || r.maxAge != null
							? `${r.minAge ?? ""}-${r.maxAge ?? ""}`
							: undefined,
				})),
			);
		},
	}),

	tool({
		name: "add_library_resource",
		description:
			"Save a reusable resource (book, video, link, material, worksheet, note) to the family's library.",
		input: z.object({
			label: z.string().min(1),
			type: resourceType,
			url: z.url().optional(),
			description: z.string().optional(),
			tags: z.array(z.string()).optional(),
			min_age: z.number().int().min(0).optional(),
			max_age: z.number().int().min(0).optional(),
		}),
		async run(input, { client, activity }) {
			unwrap(
				await client.models.LibraryResource.create({
					label: input.label,
					type: input.type,
					url: input.url ?? null,
					description: input.description ?? null,
					tags: input.tags ?? null,
					minAge: input.min_age ?? null,
					maxAge: input.max_age ?? null,
				}),
			);
			activity.push(`Saved “${input.label}” to the library`);
			return "Saved.";
		},
	}),

	tool({
		name: "record_observation",
		description:
			"Record how an activity went for a child: engagement, what they could do, what was hard. Use when a parent reports back.",
		input: z.object({
			child_id: z.string(),
			date: dateKey,
			note: z.string().min(1),
			engagement: z.enum(["low", "medium", "high"]).optional(),
			agenda_item_id: z.string().optional(),
		}),
		async run(input, { client, household, activity }) {
			assertKnownChildren(household, [input.child_id]);
			unwrap(
				await client.models.Observation.create({
					childId: input.child_id,
					date: input.date,
					note: input.note,
					engagement: input.engagement ?? null,
					agendaItemId: input.agenda_item_id ?? null,
					recordedBy: "tutor",
				}),
			);
			activity.push(
				`Noted how it went for ${household.childName(input.child_id)}`,
			);
			return "Recorded.";
		},
	}),

	tool({
		name: "get_observations",
		description: "Read recent observations about a child, newest first.",
		input: z.object({
			child_id: z.string(),
			limit: z.number().int().min(1).max(100).optional(),
		}),
		async run({ child_id, limit }, { client }) {
			const observations = unwrap(
				await client.models.Observation.observationsByChild(
					{ childId: child_id },
					{ sortDirection: "DESC", limit: limit ?? 20 },
				),
			);
			return JSON.stringify(
				observations.map((o) => ({
					date: o.date,
					note: o.note,
					engagement: o.engagement ?? undefined,
					by: o.recordedBy ?? undefined,
				})),
			);
		},
	}),

	tool({
		name: "update_learner_profile",
		description:
			"Replace your learner profile notes for a child with an updated version (you see the current notes in the household context).",
		input: z.object({ child_id: z.string(), notes: z.string() }),
		async run({ child_id, notes }, { client, household, activity }) {
			assertKnownChildren(household, [child_id]);
			const existing = unwrap(
				await client.models.LearnerProfile.get({ childId: child_id }),
			);
			unwrap(
				existing
					? await client.models.LearnerProfile.update({
							childId: child_id,
							notes,
						})
					: await client.models.LearnerProfile.create({
							childId: child_id,
							notes,
						}),
			);
			activity.push(`Updated notes on ${household.childName(child_id)}`);
			return "Saved.";
		},
	}),

	tool({
		name: "read_file",
		description:
			"Read a file the family uploaded (keys start with uploads/): PDFs and images are returned for you to view, text as text.",
		input: z.object({ key: z.string().startsWith("uploads/") }),
		async run({ key }) {
			if (key.includes("..")) throw new Error("Invalid key");
			const object = await s3.send(
				new GetObjectCommand({
					Bucket: process.env.HOUSEHOLD_BUCKET,
					Key: key,
				}),
			);
			if ((object.ContentLength ?? 0) > 15 * 1024 * 1024) {
				throw new Error("File is too large to read (over 15 MB)");
			}
			const bytes = await object.Body?.transformToByteArray();
			if (!bytes) throw new Error("Empty file");
			const type = object.ContentType ?? "";
			const data = Buffer.from(bytes).toString("base64");
			if (type === "application/pdf" || key.toLowerCase().endsWith(".pdf")) {
				return [
					{
						type: "document",
						source: { type: "base64", media_type: "application/pdf", data },
					},
				];
			}
			const imageTypes = [
				"image/jpeg",
				"image/png",
				"image/gif",
				"image/webp",
			] as const;
			const imageType = imageTypes.find((t) => t === type);
			if (imageType) {
				return [
					{
						type: "image",
						source: { type: "base64", media_type: imageType, data },
					},
				];
			}
			if (type.startsWith("text/") || type === "application/json") {
				return Buffer.from(bytes).toString("utf8").slice(0, 200_000);
			}
			throw new Error(`Can't read files of type ${type || "unknown"}`);
		},
	}),
];

// Tool definitions sent to the model. Inputs aren't guaranteed to match the
// schema (Claude streams them unvalidated; other models may simply be wrong),
// so every input is validated with zod before running (see runTool).
export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => {
	const { $schema: _, ...schema } = z.toJSONSchema(t.input, {
		io: "input",
	}) as {
		$schema?: string;
	} & Anthropic.Beta.BetaTool.InputSchema;
	return {
		name: t.name,
		description: t.description,
		input_schema: schema,
	};
});

export async function runTool(
	block: Anthropic.Beta.BetaToolUseBlockParam,
	ctx: ToolContext,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
	const definition = TOOLS.find((t) => t.name === block.name);
	if (!definition) {
		return {
			type: "tool_result",
			tool_use_id: block.id,
			is_error: true,
			content: `Unknown tool ${block.name}`,
		};
	}
	const parsed = definition.input.safeParse(block.input);
	if (!parsed.success) {
		return {
			type: "tool_result",
			tool_use_id: block.id,
			is_error: true,
			content: `Invalid input: ${z.prettifyError(parsed.error)}`,
		};
	}
	try {
		// biome-ignore lint/suspicious/noExplicitAny: each entry's run matches its own schema
		const content = await (definition.run as any)(parsed.data, ctx);
		return { type: "tool_result", tool_use_id: block.id, content };
	} catch (e) {
		return {
			type: "tool_result",
			tool_use_id: block.id,
			is_error: true,
			content: e instanceof Error ? e.message : String(e),
		};
	}
}
