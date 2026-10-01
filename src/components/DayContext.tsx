import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Repeat, School } from "lucide-react";
import { useState } from "react";
import type { AgendaItem, Child } from "~/lib/agenda";
import { applyRoutines } from "~/lib/agenda-mutations";
import { colorClasses } from "~/lib/colors";
import { compact, pendingRoutines, unitsOn } from "~/lib/planning";
import { listLearningUnits, listRoutines } from "~/lib/planning-data";

export default function DayContext({
	dateKey,
	items,
	allChildren,
	onChanged,
}: {
	dateKey: string;
	items: AgendaItem[];
	allChildren: Child[];
	onChanged: () => Promise<unknown>;
}) {
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { data: routines = [] } = useQuery({
		queryKey: ["routines"],
		queryFn: listRoutines,
	});
	const { data: units = [] } = useQuery({
		queryKey: ["learningUnits"],
		queryFn: listLearningUnits,
	});

	const pending = pendingRoutines(routines, dateKey, items);
	const todaysUnits = unitsOn(units, dateKey);
	if (pending.length === 0 && todaysUnits.length === 0) return null;

	async function addRoutines() {
		setAdding(true);
		setError(null);
		try {
			await applyRoutines(dateKey, items, pending);
			await onChanged();
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setAdding(false);
		}
	}

	return (
		<div className="mb-4 space-y-2">
			{todaysUnits.map((unit) => {
				const kids = allChildren.filter((c) =>
					compact(unit.childIds).includes(c.id),
				);
				const topics = compact(unit.topics);
				return (
					<Link
						key={unit.id}
						to="/planning/units"
						className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm transition hover:border-amber-200"
					>
						<School className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
						<div className="min-w-0 flex-1">
							<p className="font-semibold text-amber-900">
								{unit.source ? `${unit.source}: ` : ""}
								{unit.title}
								{kids.map((c) => (
									<span
										key={c.id}
										className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${colorClasses(c.color).bg} ${colorClasses(c.color).text}`}
									>
										{c.name}
									</span>
								))}
							</p>
							{topics.length > 0 && (
								<p className="truncate text-amber-800/80">
									{topics.join(" · ")}
								</p>
							)}
						</div>
					</Link>
				);
			})}

			{pending.length > 0 && (
				<div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm">
					<Repeat className="h-4 w-4 flex-shrink-0 text-indigo-500" />
					<p className="min-w-0 flex-1 text-indigo-900">
						<span className="font-semibold">
							{pending.length} routine{pending.length === 1 ? "" : "s"}
						</span>{" "}
						<span className="text-indigo-800/80">
							usually {pending.length === 1 ? "happens" : "happen"} today:{" "}
							{pending.map((r) => r.title).join(", ")}
						</span>
						{error && <span className="block text-red-600">{error}</span>}
					</p>
					<button
						type="button"
						onClick={addRoutines}
						disabled={adding}
						className="flex-shrink-0 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
					>
						{adding ? "Adding…" : "Add"}
					</button>
				</div>
			)}
		</div>
	);
}
