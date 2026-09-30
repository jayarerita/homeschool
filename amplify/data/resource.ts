import { a, type ClientSchema, defineData } from "@aws-amplify/backend";
import { GROUPS } from "../auth/groups";
import { manageMembers } from "../auth/manage-members/resource";
import { COLOR_TOKENS } from "./colors";

// Parents (and admins, who are always parents) manage everything; kids and
// devices can read the plan. See docs/ARCHITECTURE.md.
const schema = a.schema({
	Color: a.enum(COLOR_TOKENS),

	// "material" = physical supplies to gather (glue, cardstock, …).
	ResourceType: a.enum(["link", "video", "pdf", "note", "book", "material"]),

	// A file in Amplify Storage.
	Attachment: a.customType({
		s3Key: a.string().required(),
		name: a.string().required(),
		contentType: a.string(),
	}),

	Child: a
		.model({
			name: a.string().required(),
			emoji: a.string(),
			color: a.ref("Color").required(),
			birthdate: a.date(),
			gradeLevel: a.string(),
			interests: a.string().array(),
			notes: a.string(),
			sortOrder: a.integer().required(),
			archived: a.boolean().default(false),
		})
		.authorization((allow) => [
			allow.groups([GROUPS.parent]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		]),

	DayPlan: a
		.model({
			date: a.date().required(),
			summary: a.string(),
			status: a.enum(["draft", "published"]),
		})
		.identifier(["date"])
		.authorization((allow) => [
			allow.groups([GROUPS.parent]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		]),

	ResourceRef: a.customType({
		id: a.string().required(),
		label: a.string().required(),
		type: a.ref("ResourceType"),
		url: a.url(),
		s3Key: a.string(),
		description: a.string(),
		childIds: a.id().array(),
		prompts: a.string().array(),
		libraryResourceId: a.id(),
	}),

	AgendaItem: a
		.model({
			date: a.date().required(),
			sortOrder: a.integer().required(),
			// "HH:mm", 24-hour, household local time
			startTime: a.string(),
			endTime: a.string(),
			title: a.string().required(),
			emoji: a.string(),
			color: a.ref("Color"),
			description: a.string(),
			childIds: a.id().array(),
			resources: a.ref("ResourceRef").array(),
			status: a.enum(["planned", "done", "skipped"]),
			source: a.enum(["parent", "agent", "routine", "import"]),
			// Set when the item was created from a routine.
			routineId: a.id(),
		})
		.secondaryIndexes((index) => [
			index("date").sortKeys(["sortOrder"]).queryField("agendaItemsByDate"),
		])
		.authorization((allow) => [
			allow.groups([GROUPS.parent]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		]),

	// Reusable resources that can be attached to agenda items and routines.
	LibraryResource: a
		.model({
			label: a.string().required(),
			type: a.ref("ResourceType").required(),
			url: a.url(),
			s3Key: a.string(),
			description: a.string(),
			tags: a.string().array(),
			minAge: a.integer(),
			maxAge: a.integer(),
			prompts: a.string().array(),
		})
		.authorization((allow) => [
			allow.groups([GROUPS.parent]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		]),

	// Recurring blocks (morning routine, meals, …) copied into days.
	Routine: a
		.model({
			title: a.string().required(),
			emoji: a.string(),
			color: a.ref("Color"),
			description: a.string(),
			startTime: a.string(),
			endTime: a.string(),
			// 0 = Sunday … 6 = Saturday
			daysOfWeek: a.integer().array().required(),
			childIds: a.id().array(),
			resources: a.ref("ResourceRef").array(),
			active: a.boolean().default(true),
		})
		.authorization((allow) => [
			allow.groups([GROUPS.parent]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		]),

	// What a child is covering elsewhere (preschool, co-op, …) over a date
	// range, so plans at home can reinforce it.
	LearningUnit: a
		.model({
			title: a.string().required(),
			source: a.string(),
			childIds: a.id().array(),
			startDate: a.date().required(),
			endDate: a.date().required(),
			topics: a.string().array(),
			notes: a.string(),
			attachments: a.ref("Attachment").array(),
		})
		.authorization((allow) => [
			allow.groups([GROUPS.parent]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		]),

	// ── Household members (Cognito users), admin only ──
	Member: a.customType({
		username: a.string().required(),
		email: a.string(),
		status: a.string(),
		enabled: a.boolean(),
		groups: a.string().array().required(),
		createdAt: a.datetime(),
	}),

	listMembers: a
		.query()
		.returns(a.ref("Member").array())
		.authorization((allow) => [allow.group(GROUPS.admin)])
		.handler(a.handler.function(manageMembers)),

	inviteMember: a
		.mutation()
		.arguments({
			email: a.email().required(),
			groups: a.string().array().required(),
		})
		.returns(a.ref("Member"))
		.authorization((allow) => [allow.group(GROUPS.admin)])
		.handler(a.handler.function(manageMembers)),

	setMemberGroups: a
		.mutation()
		.arguments({
			username: a.string().required(),
			groups: a.string().array().required(),
		})
		.returns(a.ref("Member"))
		.authorization((allow) => [allow.group(GROUPS.admin)])
		.handler(a.handler.function(manageMembers)),

	removeMember: a
		.mutation()
		.arguments({ username: a.string().required() })
		.returns(a.boolean())
		.authorization((allow) => [allow.group(GROUPS.admin)])
		.handler(a.handler.function(manageMembers)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
	schema,
	authorizationModes: {
		defaultAuthorizationMode: "userPool",
	},
});
