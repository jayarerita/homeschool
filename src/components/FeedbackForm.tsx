import { Check } from "lucide-react";
import { useState } from "react";
import type { AgendaItem, Child, Observation } from "~/lib/agenda";
import { type Engagement, recordFeedback } from "~/lib/agenda-mutations";

const ENGAGEMENT: { value: Engagement; emoji: string; label: string }[] = [
	{ value: "low", emoji: "😕", label: "Not really" },
	{ value: "medium", emoji: "🙂", label: "Okay" },
	{ value: "high", emoji: "🤩", label: "Loved it" },
];

// "How did it go?" on an activity: a quick engagement tap and an optional note.
// Notes become observations the tutor uses when planning.
export default function FeedbackForm({
	item,
	household,
	observations,
	author,
	onSaved,
}: {
	item: AgendaItem;
	household: Child[];
	observations: Observation[];
	author: string;
	onSaved: () => Promise<unknown>;
}) {
	const [engagement, setEngagement] = useState<Engagement | null>(null);
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mine = observations.filter((o) => o.agendaItemId === item.id);
	if (mine.length > 0) {
		return (
			<div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
				<p className="flex items-center gap-1 font-semibold">
					<Check className="h-3.5 w-3.5" /> Feedback noted
				</p>
				{[...new Set(mine.map((o) => o.note))].map((text) => (
					<p key={text} className="mt-0.5">
						{text}
					</p>
				))}
			</div>
		);
	}

	const assigned = (item.childIds ?? []).filter((id): id is string => !!id);
	const childIds = assigned.length > 0 ? assigned : household.map((c) => c.id);

	return (
		<div className="mt-4 border-t border-slate-200 pt-3">
			<p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-500">
				How did it go?
			</p>
			<div className="flex gap-2">
				{ENGAGEMENT.map((e) => (
					<button
						key={e.value}
						type="button"
						aria-pressed={engagement === e.value}
						onClick={() => setEngagement(e.value)}
						className={`flex flex-1 flex-col items-center rounded-xl border px-2 py-1.5 text-xs transition ${
							engagement === e.value
								? "border-indigo-400 bg-indigo-50 text-indigo-700"
								: "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
						}`}
					>
						<span className="text-lg">{e.emoji}</span>
						{e.label}
					</button>
				))}
			</div>
			{engagement && (
				<>
					<textarea
						value={note}
						onChange={(e) => setNote(e.target.value)}
						rows={2}
						placeholder="What stood out? What could they do, what was hard? (optional)"
						className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
					/>
					<div className="mt-2 flex justify-end">
						<button
							type="button"
							disabled={busy || childIds.length === 0}
							onClick={async () => {
								setBusy(true);
								setError(null);
								try {
									await recordFeedback(
										item,
										childIds,
										engagement,
										note,
										author,
									);
									await onSaved();
								} catch (e) {
									setError((e as Error).message);
								} finally {
									setBusy(false);
								}
							}}
							className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
						>
							{busy ? "Saving…" : "Save"}
						</button>
					</div>
				</>
			)}
			{error && <p className="mt-1 text-xs text-red-600">{error}</p>}
		</div>
	);
}
