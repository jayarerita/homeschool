import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "~/hooks/useAuth";
import { client, unwrap } from "~/lib/data-client";
import type { AppNotification } from "~/lib/household";

const RECENT_DAYS = 30;

function timeAgo(iso: string): string {
	const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationBell() {
	const { user } = useAuthContext();
	const me = user?.username ?? "";
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<AppNotification[]>([]);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString();
		const subscription = client.models.Notification.observeQuery({
			filter: { createdAt: { gt: since } },
		}).subscribe({
			next: ({ items }) =>
				setItems(
					[...items]
						.filter((n) => n.type !== "test")
						.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
				),
			error: (e) => console.error("Notifications unavailable", e),
		});
		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		function onClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		}
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, []);

	const isRead = (n: AppNotification) => (n.readBy ?? []).includes(me);
	const unread = items.filter((n) => !isRead(n));

	async function markRead(notifications: AppNotification[]) {
		for (const n of notifications.filter((n) => !isRead(n))) {
			unwrap(
				await client.models.Notification.update({
					id: n.id,
					readBy: [...(n.readBy ?? []).filter((r): r is string => !!r), me],
				}),
			);
		}
	}

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
				title="Notifications"
				className="relative rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
			>
				<Bell className="h-4 w-4" />
				{unread.length > 0 && (
					<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
						{unread.length > 9 ? "9+" : unread.length}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl">
					<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
						<p className="text-sm font-bold text-slate-700">Notifications</p>
						{unread.length > 0 && (
							<button
								type="button"
								onClick={() => markRead(unread)}
								className="text-xs font-semibold text-indigo-600 hover:underline"
							>
								Mark all read
							</button>
						)}
					</div>
					<div className="max-h-96 overflow-y-auto">
						{items.length === 0 ? (
							<p className="px-4 py-6 text-center text-sm text-slate-400">
								Nothing yet. Plans, reminders and check-ins will show up here.
							</p>
						) : (
							items.map((n) => (
								<button
									key={n.id}
									type="button"
									onClick={async () => {
										setOpen(false);
										await markRead([n]);
										if (n.url) navigate({ href: n.url });
									}}
									className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
										isRead(n) ? "" : "bg-indigo-50/50"
									}`}
								>
									<div className="flex items-start gap-2">
										{!isRead(n) && (
											<span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
										)}
										<div className="min-w-0 flex-1">
											<p className="text-sm font-semibold text-slate-700">
												{n.title}
											</p>
											{n.body && (
												<p className="mt-0.5 line-clamp-3 text-xs text-slate-500">
													{n.body}
												</p>
											)}
											<p className="mt-1 text-[11px] text-slate-400">
												{timeAgo(n.createdAt)}
											</p>
										</div>
									</div>
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
