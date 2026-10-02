import { a, type ClientSchema, defineData } from "@aws-amplify/backend";
import { GROUPS } from "../auth/groups";
import { manageMembers } from "../auth/manage-members/resource";
import { householdJobs } from "../functions/household-jobs/resource";
import { tutorTurn } from "../functions/tutor-turn/resource";
import { COLOR_TOKENS } from "./colors";

// Parents (and admins, who are always parents) manage everything; kids and
// devices can read the plan. See docs/ARCHITECTURE.md.
const schema = a
	.schema({
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

		// ── Tutor ──
		// Chat threads with the tutor. "lesson" threads guide one agenda item
		// with a child present; "parent" threads are for planning.
		Conversation: a
			.model({
				title: a.string(),
				mode: a.enum(["parent", "lesson"]),
				childId: a.id(),
				agendaItemId: a.id(),
				lastMessageAt: a.datetime(),
			})
			.authorization((allow) => [allow.groups([GROUPS.parent])]),

		// What the chat UI shows. The verbatim API transcript of each turn lives in
		// S3 (tutor/<conversationId>/<messageId>.json) because it can exceed
		// DynamoDB's item size and must be replayed unchanged.
		TutorMessage: a
			.model({
				conversationId: a.id().required(),
				sentAt: a.datetime().required(),
				role: a.enum(["user", "assistant"]),
				text: a.string(),
				authorName: a.string(),
				status: a.enum(["pending", "streaming", "done", "error"]),
				error: a.string(),
				// Short summaries of what the tutor changed during this turn.
				activity: a.string().array(),
			})
			.secondaryIndexes((index) => [
				index("conversationId")
					.sortKeys(["sentAt"])
					.queryField("tutorMessagesByConversation"),
			])
			.authorization((allow) => [allow.groups([GROUPS.parent])]),

		// Tutor-maintained notes about each child: strengths, what they're working
		// on, what engages them. One record per child.
		LearnerProfile: a
			.model({
				childId: a.id().required(),
				notes: a.string(),
			})
			.identifier(["childId"])
			.authorization((allow) => [
				allow.groups([GROUPS.parent]),
				allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
			]),

		// Feedback on how an activity went, from a parent or noted by the tutor.
		Observation: a
			.model({
				childId: a.id().required(),
				date: a.date().required(),
				agendaItemId: a.id(),
				note: a.string().required(),
				engagement: a.enum(["low", "medium", "high"]),
				recordedBy: a.string(),
			})
			.secondaryIndexes((index) => [
				index("childId").sortKeys(["date"]).queryField("observationsByChild"),
			])
			.authorization((allow) => [allow.groups([GROUPS.parent])]),

		// Runs one tutor turn in the background: the Lambda streams its reply into
		// the given assistant TutorMessage, which the UI watches via subscription.
		runTutorTurn: a
			.mutation()
			.arguments({
				conversationId: a.id().required(),
				messageId: a.id().required(),
				timeZone: a.string(),
			})
			.authorization((allow) => [allow.group(GROUPS.parent)])
			.handler(a.handler.function(tutorTurn).async()),

		// ── Planner and notifications ──
		// One record (id "household") with settings for scheduled jobs. Times
		// are hours (0-23) in the household's time zone.
		HouseholdSettings: a
			.model({
				timeZone: a.string(),
				// Origin of the web app, for links in notifications.
				appUrl: a.string(),
				plannerEnabled: a.boolean().default(true),
				planDaysAhead: a.integer().default(1),
				plannerHour: a.integer().default(16),
				materialsHour: a.integer().default(19),
				feedbackHour: a.integer().default(18),
				// 0 = Sunday … 6 = Saturday
				weeklyPreviewDay: a.integer().default(0),
				weeklyPreviewHour: a.integer().default(17),
				// A verified Amazon SES identity; email is off until this is set.
				emailFrom: a.string(),
			})
			.authorization((allow) => [
				allow.groups([GROUPS.parent]),
				allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
			]),

		// In-app notifications for the household's parents. Push and email are
		// delivered from these by the household-jobs Lambda.
		Notification: a
			.model({
				type: a.enum([
					"plan_ready",
					"materials",
					"feedback",
					"weekly_preview",
					"tutor",
					"test",
				]),
				title: a.string().required(),
				body: a.string(),
				// In-app path to open, e.g. /?date=2026-10-01
				url: a.string(),
				// Prevents duplicates when an hourly job runs again.
				dedupeKey: a.string(),
				// Cognito usernames of parents who have read it.
				readBy: a.string().array(),
				// Cognito usernames it has been pushed or emailed to.
				deliveredTo: a.string().array(),
			})
			.secondaryIndexes((index) => [
				index("dedupeKey").queryField("notificationsByDedupeKey"),
			])
			.authorization((allow) => [allow.groups([GROUPS.parent])]),

		// A browser's Web Push subscription, one per device.
		PushSubscription: a
			.model({
				endpoint: a.string().required(),
				p256dh: a.string().required(),
				auth: a.string().required(),
				userAgent: a.string(),
			})
			.authorization((allow) => [allow.owner()]),

		// Each parent's own delivery preferences.
		NotificationPrefs: a
			.model({
				pushEnabled: a.boolean().default(true),
				emailEnabled: a.boolean().default(false),
				email: a.email(),
				// Notification types this parent doesn't want pushed or emailed.
				mutedTypes: a.string().array(),
				// Quiet hours (0-23, household time); held deliveries go out after.
				quietStart: a.integer(),
				quietEnd: a.integer(),
			})
			.authorization((allow) => [allow.owner()]),

		// ── AI provider (admin only) ──
		// The API key itself is never returned; only its last four characters.
		AiSettings: a.customType({
			provider: a.string().required(),
			model: a.string().required(),
			keyHint: a.string(),
			// "settings" when chosen in the app, "deployment" when from env vars.
			source: a.string().required(),
		}),

		aiSettings: a
			.query()
			.returns(a.ref("AiSettings"))
			.authorization((allow) => [allow.group(GROUPS.admin)])
			.handler(a.handler.function(householdJobs)),

		// apiKey: a new Claude API key (verified before saving); clearApiKey
		// removes the saved one.
		setAiSettings: a
			.mutation()
			.arguments({
				provider: a.string().required(),
				model: a.string().required(),
				apiKey: a.string(),
				clearApiKey: a.boolean(),
			})
			.returns(a.ref("AiSettings"))
			.authorization((allow) => [allow.group(GROUPS.admin)])
			.handler(a.handler.function(householdJobs)),

		pushPublicKey: a
			.query()
			.returns(a.string())
			.authorization((allow) => [allow.group(GROUPS.parent)])
			.handler(a.handler.function(householdJobs)),

		sendTestNotification: a
			.mutation()
			.returns(a.string())
			.authorization((allow) => [allow.group(GROUPS.parent)])
			.handler(a.handler.function(householdJobs)),

		// Asks the planner to draft a day now instead of waiting for the evening.
		draftDay: a
			.mutation()
			.arguments({ date: a.date().required() })
			.authorization((allow) => [allow.group(GROUPS.parent)])
			.handler(a.handler.function(householdJobs).async()),

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
	})
	// The tutor Lambda reads and writes household data with IAM.
	.authorization((allow) => [
		allow.resource(tutorTurn),
		allow.resource(householdJobs),
	]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
	schema,
	authorizationModes: {
		defaultAuthorizationMode: "userPool",
	},
});
