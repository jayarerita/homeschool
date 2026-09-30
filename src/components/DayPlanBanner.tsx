import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import type { AgendaItem, DayPlan } from "~/lib/agenda";
import { discardDraft, publishDay, requestDraft } from "~/lib/agenda-mutations";

// The tutor is working on this day: a draft with no summary yet.
export function isDrafting(plan: DayPlan | null | undefined): boolean {
	return plan?.status === "draft" && !plan.summary;
}

export default function DayPlanBanner({
	date,
	plan,
	items,
	drafting = false,
	onChanged,
}: {
	date: string;
	plan: DayPlan | null;
	items: AgendaItem[];
	// A draft was requested from this page and hasn't started showing yet.
	drafting?: boolean;
	onChanged: () => Promise<unknown>;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function run(action: () => Promise<unknown>) {
		setBusy(true);
		setError(null);
		try {
			await action();
			await onChanged();
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(false);
		}
	}

	if (drafting || isDrafting(plan)) {
		return (
			<div className="mb-4 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
				<Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-violet-500" />
				The tutor is drafting this day. This usually takes a minute or two.
			</div>
		);
	}

	if (plan?.status === "draft") {
		const suggestions = items.filter((i) => i.source === "agent").length;
		return (
			<div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm">
				<div className="flex items-start gap-3">
					<Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" />
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-violet-900">
							Draft plan from the tutor
						</p>
						{plan.summary && (
							<p className="mt-0.5 text-violet-800/80">{plan.summary}</p>
						)}
						<p className="mt-1 text-xs text-violet-700/70">
							Edit anything, then publish it.
						</p>
					</div>
				</div>
				<div className="mt-3 flex flex-wrap justify-end gap-2">
					{suggestions > 0 && (
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								if (
									window.confirm(
										`Remove the tutor's ${suggestions} suggested activit${suggestions === 1 ? "y" : "ies"}? Routines and anything you added stay.`,
									)
								) {
									run(() => discardDraft(date, items));
								}
							}}
							className="rounded-xl px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
						>
							Remove suggestions
						</button>
					)}
					<button
						type="button"
						disabled={busy}
						onClick={() => run(() => publishDay(date))}
						className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
					>
						Publish
					</button>
				</div>
				{error && <p className="mt-2 text-xs text-red-600">{error}</p>}
			</div>
		);
	}

	return error ? <p className="mb-4 text-xs text-red-600">{error}</p> : null;
}

// Offered on an empty day: ask the planner to draft it now.
export function DraftDayButton({
	date,
	onChanged,
}: {
	date: string;
	onChanged: () => Promise<unknown>;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	return (
		<>
			<button
				type="button"
				disabled={busy}
				onClick={async () => {
					setBusy(true);
					setError(null);
					try {
						await requestDraft(date);
						await onChanged();
					} catch (e) {
						setError((e as Error).message);
					} finally {
						setBusy(false);
					}
				}}
				className="mt-3 flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
			>
				<Sparkles className="h-4 w-4" />
				Ask the tutor to draft this day
			</button>
			{error && <p className="mt-2 text-xs text-red-600">{error}</p>}
		</>
	);
}
