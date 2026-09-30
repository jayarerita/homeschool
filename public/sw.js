// Service worker for Web Push notifications from the household-jobs Lambda.
// Payload: { title, body, url, tag }.

self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { title: "Homeschool", body: event.data?.text() };
	}
	event.waitUntil(
		self.registration.showNotification(data.title || "Homeschool", {
			body: data.body || "",
			tag: data.tag,
			icon: "/android-chrome-192x192.png",
			badge: "/favicon-32x32.png",
			data: { url: data.url || "/" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url || "/", self.location.origin);
	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((windows) => {
				const open = windows.find((w) => new URL(w.url).origin === url.origin);
				if (open) {
					open.navigate(url.href);
					return open.focus();
				}
				return self.clients.openWindow(url.href);
			}),
	);
});
