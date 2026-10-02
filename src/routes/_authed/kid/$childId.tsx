import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";
import ParentGate from "~/components/ParentGate";
import { formatTimeRange, getAgendaForDate, toDateKey } from "~/lib/agenda";
import { colorClasses } from "~/lib/colors";
import { clearKidMode, itemsForChild } from "~/lib/kid-mode";
import { createLessonConversation } from "~/lib/tutor";

export const Route = createFileRoute("/_authed/kid/$childId")({
	component: KidDay,
});

// A child's simple view of today: big cards, and a button to start each
// activity with the tutor.
function KidDay() {
	const { childId } = Route.useParams();
	const navigate = useNavigate();
	const [unlocking, setUnlocking] = useState(false);
	const [starting, setStarting] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const today = toDateKey(new Date());

	const { data, isLoading } = useQuery({
		queryKey: ["agenda", today],
		queryFn: () => getAgendaForDate(today),
	});
	const child = data?.children.find((c) => c.id === childId);
	const colors = colorClasses(child?.color);
	const items = itemsForChild(data?.items ?? [], childId).filter(
		(i) => i.status !== "skipped",
	);

	async function start(itemId: string) {
		const item = items.find((i) => i.id === itemId);
		if (!item) return;
		setStarting(itemId);
		setError(null);
		try {
			const conversation = await createLessonConversation(item, childId);
			navigate({
				to: "/lesson/$conversationId",
				params: { conversationId: conversation.id },
			});
		} catch (e) {
			setError((e as Error).message);
			setStarting(null);
		}
	}

	return (
		<div className={`min-h-full px-5 py-6 ${colors.bg}`}>
			<div className="mx-auto max-w-2xl">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-4xl shadow-sm">
							{child?.emoji || child?.name.charAt(0) || "🙂"}
						</span>
						<h1 className={`text-3xl font-bold ${colors.text}`}>
							{child ? `Hi, ${child.name}!` : "Hi!"}
						</h1>
					</div>
					<button
						type="button"
						onClick={() => setUnlocking(true)}
						aria-label="Grown-ups: leave kid mode"
						title="Grown-ups: leave kid mode"
						className="rounded-full bg-white/70 p-3 text-slate-400 hover:text-slate-600"
					>
						<Lock className="h-5 w-5" />
					</button>
				</div>

				<p className="mt-6 text-xl font-semibold text-slate-700">
					Today's adventures
				</p>
				{isLoading && <p className="mt-6 text-slate-500">Loading…</p>}
				{!isLoading && items.length === 0 && (
					<p className="mt-6 rounded-3xl bg-white p-8 text-center text-xl text-slate-500">
						Nothing planned yet. Time to play! 🎈
					</p>
				)}
				{error && <p className="mt-4 text-red-600">{error}</p>}

				<div className="mt-4 space-y-4">
					{items.map((item) => {
						const time = formatTimeRange(item.startTime, item.endTime);
						const itemColors = colorClasses(item.color);
						const done = item.status === "done";
						return (
							<div
								key={item.id}
								className={`flex items-center gap-4 rounded-[2rem] bg-white p-5 shadow-sm ${done ? "opacity-60" : ""}`}
							>
								<span
									className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-3xl text-5xl ${itemColors.bg}`}
								>
									{item.emoji || "⭐"}
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-2xl font-bold text-slate-800">
										{item.title}
									</p>
									{time && <p className="text-lg text-slate-500">{time}</p>}
								</div>
								{done ? (
									<span className="text-4xl" role="img" aria-label="Done">
										✅
									</span>
								) : (
									<button
										type="button"
										disabled={starting !== null}
										onClick={() => start(item.id)}
										className="flex-shrink-0 rounded-full bg-indigo-600 px-6 py-4 text-xl font-bold text-white shadow-md transition hover:bg-indigo-700 active:scale-95 disabled:opacity-60"
									>
										{starting === item.id ? "…" : "Let's go!"}
									</button>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{unlocking && (
				<ParentGate
					onCancel={() => setUnlocking(false)}
					onUnlock={() => {
						clearKidMode();
						navigate({ to: "/" });
					}}
				/>
			)}
		</div>
	);
}
