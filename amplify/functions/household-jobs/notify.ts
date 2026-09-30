import {
	GetObjectCommand,
	NoSuchKey,
	PutObjectCommand,
	S3Client,
	S3ServiceException,
} from "@aws-sdk/client-s3";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import webpush from "web-push";
import type { Schema } from "../../data/resource";
import { type DataClient, unwrap } from "../tutor-core/data";
import { inQuietHours, type Settings } from "./schedule";

type Notification = Schema["Notification"]["type"];
type NotificationType = NonNullable<Notification["type"]>;
type Subscription = Schema["PushSubscription"]["type"];
type Prefs = Schema["NotificationPrefs"]["type"];

const s3 = new S3Client();
const ses = new SESv2Client();
const Bucket = process.env.HOUSEHOLD_BUCKET;
// Only notifications this recent are delivered; older ones stay in-app only.
const DELIVERY_WINDOW_MS = 36 * 60 * 60 * 1000;

// ── VAPID keys for Web Push ──
// Generated on first use and kept in the household bucket under system/,
// which browsers can't read, so self-hosters have nothing to configure.

type VapidKeys = { publicKey: string; privateKey: string };
let vapidKeys: Promise<VapidKeys> | undefined;

export function getVapidKeys(): Promise<VapidKeys> {
	vapidKeys ??= (async () => {
		const Key = "system/vapid.json";
		const read = async () => {
			const object = await s3.send(new GetObjectCommand({ Bucket, Key }));
			return JSON.parse(
				await (object.Body?.transformToString() ?? ""),
			) as VapidKeys;
		};
		try {
			return await read();
		} catch (e) {
			if (!(e instanceof NoSuchKey)) throw e;
		}
		const fresh = webpush.generateVAPIDKeys();
		try {
			// IfNoneMatch: two cold starts racing keep the first key pair.
			await s3.send(
				new PutObjectCommand({
					Bucket,
					Key,
					Body: JSON.stringify(fresh),
					ContentType: "application/json",
					IfNoneMatch: "*",
				}),
			);
			return fresh;
		} catch (e) {
			if (
				e instanceof S3ServiceException &&
				e.$metadata.httpStatusCode === 412
			) {
				return read();
			}
			throw e;
		}
	})();
	vapidKeys.catch(() => {
		vapidKeys = undefined;
	});
	return vapidKeys;
}

// ── Creating notifications ──

export async function createNotification(
	client: DataClient,
	fields: {
		type: NotificationType;
		title: string;
		body?: string;
		url?: string;
		dedupeKey?: string;
	},
): Promise<Notification | null> {
	if (fields.dedupeKey) {
		const existing = unwrap(
			await client.models.Notification.notificationsByDedupeKey({
				dedupeKey: fields.dedupeKey,
			}),
		);
		if (existing.length > 0) return null;
	}
	return unwrap(
		await client.models.Notification.create({
			...fields,
			readBy: [],
			deliveredTo: [],
		}),
	);
}

// ── Delivery ──

function absoluteUrl(settings: Settings, path: string | null | undefined) {
	const base = settings.appUrl?.replace(/\/$/, "") ?? "";
	return `${base}${path ?? "/"}`;
}

function vapidSubject(settings: Settings, prefs: Prefs[]): string {
	if (settings.appUrl?.startsWith("https://")) return settings.appUrl;
	const email = prefs.find((p) => p.email)?.email;
	return `mailto:${email ?? "homeschool@example.com"}`;
}

async function pushTo(
	client: DataClient,
	subscriptions: Subscription[],
	notification: Notification,
	subject: string,
): Promise<number> {
	const keys = await getVapidKeys();
	const payload = JSON.stringify({
		title: notification.title,
		body: notification.body ?? "",
		url: notification.url ?? "/",
		tag: notification.dedupeKey ?? notification.id,
	});
	let sent = 0;
	for (const sub of subscriptions) {
		try {
			await webpush.sendNotification(
				{
					endpoint: sub.endpoint,
					keys: { p256dh: sub.p256dh, auth: sub.auth },
				},
				payload,
				{
					TTL: 24 * 60 * 60,
					vapidDetails: { subject, ...keys },
				},
			);
			sent++;
		} catch (e) {
			const status = (e as { statusCode?: number }).statusCode;
			if (status === 404 || status === 410) {
				// The browser dropped this subscription.
				await client.models.PushSubscription.delete({ id: sub.id });
			} else {
				console.error("Push failed", sub.endpoint, e);
			}
		}
	}
	return sent;
}

async function emailTo(
	address: string,
	notification: Notification,
	settings: Settings,
): Promise<boolean> {
	if (!settings.emailFrom) return false;
	try {
		await ses.send(
			new SendEmailCommand({
				FromEmailAddress: settings.emailFrom,
				Destination: { ToAddresses: [address] },
				Content: {
					Simple: {
						Subject: { Data: notification.title },
						Body: {
							Text: {
								Data: `${notification.body ?? ""}\n\nOpen: ${absoluteUrl(settings, notification.url)}`,
							},
						},
					},
				},
			}),
		);
		return true;
	} catch (e) {
		console.error("Email failed", address, e);
		return false;
	}
}

type Recipient = {
	owner: string;
	prefs?: Prefs;
	subscriptions: Subscription[];
};

async function loadRecipients(client: DataClient): Promise<Recipient[]> {
	const [subscriptions, prefs] = await Promise.all([
		client.models.PushSubscription.list({ limit: 1000 }).then(unwrap),
		client.models.NotificationPrefs.list({ limit: 1000 }).then(unwrap),
	]);
	const owners = new Set(
		[...subscriptions, ...prefs]
			.map((r) => r.owner)
			.filter((o): o is string => !!o),
	);
	return [...owners].map((owner) => ({
		owner,
		prefs: prefs.find((p) => p.owner === owner),
		subscriptions: subscriptions.filter((s) => s.owner === owner),
	}));
}

// Sends one notification to one parent, by push and/or email per their prefs.
async function deliverTo(
	client: DataClient,
	recipient: Recipient,
	notification: Notification,
	settings: Settings,
	subject: string,
): Promise<{ pushed: number; emailed: boolean }> {
	const prefs = recipient.prefs;
	const pushed =
		prefs?.pushEnabled === false
			? 0
			: await pushTo(client, recipient.subscriptions, notification, subject);
	const emailed =
		prefs?.emailEnabled && prefs.email
			? await emailTo(prefs.email, notification, settings)
			: false;
	return { pushed, emailed };
}

// Delivers recent notifications to every parent who hasn't had them yet,
// skipping muted types and holding deliveries during quiet hours.
export async function deliverPending(
	client: DataClient,
	settings: Settings,
	now: Date,
	localHour: number,
): Promise<void> {
	const since = new Date(now.getTime() - DELIVERY_WINDOW_MS).toISOString();
	const [notifications, recipients] = await Promise.all([
		client.models.Notification.list({
			filter: { createdAt: { gt: since } },
			limit: 1000,
		}).then(unwrap),
		loadRecipients(client),
	]);
	if (recipients.length === 0) return;
	const subject = vapidSubject(
		settings,
		recipients.flatMap((r) => (r.prefs ? [r.prefs] : [])),
	);

	for (const notification of notifications) {
		if (notification.type === "test") continue;
		const delivered = new Set(
			(notification.deliveredTo ?? []).filter((o): o is string => !!o),
		);
		const read = new Set(
			(notification.readBy ?? []).filter((o): o is string => !!o),
		);
		let changed = false;
		for (const recipient of recipients) {
			if (delivered.has(recipient.owner)) continue;
			const muted = (recipient.prefs?.mutedTypes ?? []).includes(
				notification.type ?? "",
			);
			if (read.has(recipient.owner) || muted) {
				// Already seen in the app, or unwanted: nothing to send.
				delivered.add(recipient.owner);
				changed = true;
				continue;
			}
			if (
				inQuietHours(
					localHour,
					recipient.prefs?.quietStart,
					recipient.prefs?.quietEnd,
				)
			) {
				continue; // try again next hour
			}
			await deliverTo(client, recipient, notification, settings, subject);
			delivered.add(recipient.owner);
			changed = true;
		}
		if (changed) {
			unwrap(
				await client.models.Notification.update({
					id: notification.id,
					deliveredTo: [...delivered],
				}),
			);
		}
	}
}

// Sends a test notification to one parent's devices right away.
export async function sendTest(
	client: DataClient,
	settings: Settings,
	owner: string,
): Promise<string> {
	const recipient = (await loadRecipients(client)).find(
		(r) => r.owner === owner,
	);
	const notification = await createNotification(client, {
		type: "test",
		title: "Test notification",
		body: "Notifications from Homeschool are working on this device.",
		url: "/settings",
	});
	if (!notification) return "Could not create a test notification.";
	if (!recipient) {
		return "No devices are set up for you yet. Turn on notifications on this device first.";
	}
	const subject = vapidSubject(
		settings,
		recipient.prefs ? [recipient.prefs] : [],
	);
	const { pushed, emailed } = await deliverTo(
		client,
		recipient,
		notification,
		settings,
		subject,
	);
	const parts = [
		`Pushed to ${pushed} device${pushed === 1 ? "" : "s"}`,
		recipient.prefs?.emailEnabled
			? emailed
				? "emailed you"
				: settings.emailFrom
					? "email failed (check that the address is verified in Amazon SES)"
					: "email is off until a sender address is set in household settings"
			: null,
	].filter(Boolean);
	return `${parts.join("; ")}.`;
}
