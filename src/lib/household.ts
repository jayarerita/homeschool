import { client, type Schema, unwrap } from "./data-client";

export type HouseholdSettings = Schema["HouseholdSettings"]["type"];
export type NotificationPrefs = Schema["NotificationPrefs"]["type"];
export type AppNotification = Schema["Notification"]["type"];

// Scheduled jobs read their settings from this single record.
export const HOUSEHOLD_ID = "household";

export function browserTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Created on first use with this browser's time zone and the app's address,
// both editable in Settings.
export async function getHouseholdSettings(): Promise<HouseholdSettings> {
	const existing = unwrap(
		await client.models.HouseholdSettings.get({ id: HOUSEHOLD_ID }),
	);
	if (existing) return existing;
	const created = unwrap(
		await client.models.HouseholdSettings.create({
			id: HOUSEHOLD_ID,
			timeZone: browserTimeZone(),
			appUrl: window.location.origin,
		}),
	);
	if (!created) throw new Error("Could not create household settings.");
	return created;
}

// This parent's own preferences (the list is owner-scoped).
export async function getMyNotificationPrefs(): Promise<NotificationPrefs> {
	const [existing] = unwrap(
		await client.models.NotificationPrefs.list({ limit: 10 }),
	);
	if (existing) return existing;
	const created = unwrap(
		await client.models.NotificationPrefs.create({
			pushEnabled: true,
			emailEnabled: false,
			quietStart: 21,
			quietEnd: 7,
		}),
	);
	if (!created) throw new Error("Could not create notification settings.");
	return created;
}

export const NOTIFICATION_TYPES: {
	value: NonNullable<AppNotification["type"]>;
	label: string;
}[] = [
	{ value: "plan_ready", label: "Draft plans ready to review" },
	{ value: "materials", label: "Materials to gather for tomorrow" },
	{ value: "feedback", label: "How did today go?" },
	{ value: "weekly_preview", label: "Weekly preview" },
	{ value: "tutor", label: "Messages from the tutor" },
];

export function hourLabel(hour: number): string {
	return new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", {
		hour: "numeric",
	});
}
