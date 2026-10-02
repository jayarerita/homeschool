import type { AppSyncIdentityCognito } from "aws-lambda";
import { isValidTimeZone } from "../tutor-core/context";
import { type DataClient, dataClient, unwrap } from "../tutor-core/data";
import { getAiSettings, setAiSettings } from "./ai-settings";
import {
	feedbackRequest,
	materialsReminder,
	planUpcomingDays,
	weeklyPreview,
} from "./jobs";
import { deliverPending, getVapidKeys, sendTest } from "./notify";
import { draftDay } from "./planner";
import {
	DEFAULT_SETTINGS,
	dueJobs,
	type Job,
	localClock,
	type Settings,
} from "./schedule";
import { speak } from "./speech";

// This function runs hourly on a schedule and also serves these AppSync
// operations: pushPublicKey, sendTestNotification, draftDay, speak, and the
// admin's aiSettings / setAiSettings.
type AppSyncEvent = {
	fieldName?: string;
	info?: { fieldName?: string };
	arguments?: Record<string, unknown>;
	identity?: AppSyncIdentityCognito;
};

async function loadSettings(client: DataClient): Promise<Settings> {
	const record = unwrap(
		await client.models.HouseholdSettings.get({ id: "household" }),
	);
	if (!record) return DEFAULT_SETTINGS;
	const pick = <K extends keyof Settings>(key: K): Settings[K] =>
		(record[key] ?? DEFAULT_SETTINGS[key]) as Settings[K];
	return {
		timeZone: isValidTimeZone(record.timeZone)
			? (record.timeZone as string)
			: DEFAULT_SETTINGS.timeZone,
		plannerEnabled: pick("plannerEnabled"),
		planDaysAhead: pick("planDaysAhead"),
		plannerHour: pick("plannerHour"),
		materialsHour: pick("materialsHour"),
		feedbackHour: pick("feedbackHour"),
		weeklyPreviewDay: pick("weeklyPreviewDay"),
		weeklyPreviewHour: pick("weeklyPreviewHour"),
		appUrl: pick("appUrl"),
		emailFrom: pick("emailFrom"),
	};
}

async function runJob(
	client: DataClient,
	settings: Settings,
	job: Job,
	now: Date,
	clock: ReturnType<typeof localClock>,
) {
	switch (job.kind) {
		case "planner":
			return planUpcomingDays(client, settings, job.dates, now);
		case "materials":
			return materialsReminder(client, settings, job.date);
		case "feedback":
			return feedbackRequest(client, job.date, clock);
		case "weekly_preview":
			return weeklyPreview(client, job.weekStart);
	}
}

async function hourlyTick(client: DataClient) {
	const now = new Date();
	const settings = await loadSettings(client);
	const clock = localClock(now, settings.timeZone);
	for (const job of dueJobs(settings, clock)) {
		try {
			await runJob(client, settings, job, now, clock);
		} catch (e) {
			// One failing job shouldn't stop the others or delivery.
			console.error(`Job ${job.kind} failed`, e);
		}
	}
	await deliverPending(client, settings, now, clock.hour);
}

export const handler = async (event: AppSyncEvent) => {
	const client = await dataClient();
	// Amplify's resolver passes fieldName at the top level of the payload.
	const fieldName = event.fieldName ?? event.info?.fieldName;

	switch (fieldName) {
		case undefined:
			return hourlyTick(client);

		case "aiSettings":
			return getAiSettings();

		case "setAiSettings":
			return setAiSettings(
				event.arguments ?? {},
				event.identity?.username ?? "unknown",
			);

		case "speak":
			return speak(String(event.arguments?.text ?? ""));

		case "pushPublicKey":
			return (await getVapidKeys()).publicKey;

		case "sendTestNotification": {
			const username = event.identity?.username;
			if (!username) throw new Error("Not signed in.");
			// Owner-authorized records store "sub::username" but are read back
			// as the username alone, which is what recipients are keyed by.
			return sendTest(client, await loadSettings(client), username);
		}

		case "draftDay": {
			const date = String(event.arguments?.date ?? "");
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date.");
			try {
				await draftDay(client, await loadSettings(client), date, new Date(), {
					force: true,
				});
			} catch (e) {
				// draftDay has recorded the failure on the day for the app to show.
				console.error("Draft failed", e);
			}
			return;
		}

		default:
			throw new Error(`Unknown operation: ${fieldName}`);
	}
};
