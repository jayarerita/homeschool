import { client, unwrap } from "./data-client";

export type PushState = "unsupported" | "denied" | "off" | "on";

export function pushSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	);
}

async function registration(): Promise<ServiceWorkerRegistration> {
	return (
		(await navigator.serviceWorker.getRegistration("/")) ??
		(await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
	);
}

export async function pushState(): Promise<PushState> {
	if (!pushSupported()) return "unsupported";
	if (Notification.permission === "denied") return "denied";
	const reg = await navigator.serviceWorker.getRegistration("/");
	const sub = await reg?.pushManager.getSubscription();
	return sub ? "on" : "off";
}

// The VAPID public key, base64url, as the Uint8Array PushManager expects.
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
	const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Subscribes this browser and records it so the backend can push to it.
export async function enablePush(): Promise<void> {
	if (!pushSupported()) {
		throw new Error(
			"This browser can't receive notifications. On iPhone or iPad, add the app to your Home Screen first.",
		);
	}
	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		throw new Error(
			"Notifications are blocked for this site in your browser settings.",
		);
	}
	const publicKey = unwrap(await client.queries.pushPublicKey());
	if (!publicKey) throw new Error("The server has no push key yet.");

	const reg = await registration();
	await navigator.serviceWorker.ready;
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyBytes(publicKey),
		}));
	const json = sub.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
		throw new Error("The browser returned an incomplete subscription.");
	}

	// Owner-scoped: lists only this parent's own subscriptions.
	const existing = unwrap(
		await client.models.PushSubscription.list({ limit: 1000 }),
	);
	if (!existing.some((s) => s.endpoint === json.endpoint)) {
		unwrap(
			await client.models.PushSubscription.create({
				endpoint: json.endpoint,
				p256dh: json.keys.p256dh,
				auth: json.keys.auth,
				userAgent: navigator.userAgent.slice(0, 200),
			}),
		);
	}
}

export async function disablePush(): Promise<void> {
	const reg = await navigator.serviceWorker.getRegistration("/");
	const sub = await reg?.pushManager.getSubscription();
	if (!sub) return;
	const existing = unwrap(
		await client.models.PushSubscription.list({ limit: 1000 }),
	);
	for (const record of existing.filter((s) => s.endpoint === sub.endpoint)) {
		unwrap(await client.models.PushSubscription.delete({ id: record.id }));
	}
	await sub.unsubscribe();
}
