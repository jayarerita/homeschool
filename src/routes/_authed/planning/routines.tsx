import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useState } from "react";
import ActivityForm, {
	fromActivityDraft,
	toActivityDraft,
} from "~/components/ActivityForm";
import Modal from "~/components/Modal";
import Section, { labelClass, primaryButtonClass } from "~/components/Section";
import { formatTimeRange, listChildren } from "~/lib/agenda";
import { colorClasses } from "~/lib/colors";
import { client, unwrap } from "~/lib/data-client";
import { compact, WEEKDAYS } from "~/lib/planning";
import { listRoutines, type Routine } from "~/lib/planning-data";

export const Route = createFileRoute("/_authed/planning/routines")({
	component: RoutinesPage,
});

const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

function describeDays(days: number[]): string {
	const sorted = [...days].sort();
	if (sorted.length === 7) return "Every day";
	if (sorted.join() === WEEKDAYS_ONLY.join()) return "Weekdays";
	if (sorted.join() === "0,6") return "Weekends";
	return sorted.map((d) => WEEKDAYS[d].short).join(" ");
}

function DayPicker({
	value,
	onChange,
}: {
	value: number[];
	onChange: (days: number[]) => void;
}) {
	return (
		<div>
			<span className={labelClass}>Days</span>
			<div className="flex flex-wrap gap-1.5">
				{WEEKDAYS.map((day) => {
					const selected = value.includes(day.value);
					return (
						<button
							key={day.value}
							type="button"
							aria-pressed={selected}
							aria-label={day.label}
							onClick={() =>
								onChange(
									selected
										? value.filter((d) => d !== day.value)
										: [...value, day.value],
								)
							}
							className={`h-9 w-9 rounded-full text-xs font-bold transition ${
								selected
									? "bg-indigo-600 text-white"
									: "bg-slate-100 text-slate-500 hover:bg-slate-200"
							}`}
						>
							{day.short}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function RoutineEditor({
	routine,
	onDone,
}: {
	routine: Routine | null;
	onDone: () => void;
}) {
	const queryClient = useQueryClient();
	const [days, setDays] = useState<number[]>(
		routine ? compact(routine.daysOfWeek) : WEEKDAYS_ONLY,
	);
	const [active, setActive] = useState(routine?.active !== false);
	const { data: children = [] } = useQuery({
		queryKey: ["children"],
		queryFn: listChildren,
	});

	const saved = async () => {
		await queryClient.invalidateQueries({ queryKey: ["routines"] });
		onDone();
	};

	return (
		<Modal title={routine ? "Edit routine" : "Add routine"} onClose={onDone}>
			<ActivityForm
				initial={toActivityDraft(routine ?? undefined)}
				household={children.filter((c) => !c.archived)}
				submitLabel={routine ? "Save" : "Add"}
				onCancel={onDone}
				extra={
					<>
						<DayPicker value={days} onChange={setDays} />
						<label className="flex items-center gap-2 text-sm text-slate-600">
							<input
								type="checkbox"
								checked={active}
								onChange={(e) => setActive(e.target.checked)}
							/>
							Active (uncheck to pause, e.g. over holidays)
						</label>
					</>
				}
				onSubmit={async (draft) => {
					if (days.length === 0) throw new Error("Pick at least one day.");
					const fields = {
						...fromActivityDraft(draft),
						daysOfWeek: [...days].sort(),
						active,
					};
					unwrap(
						routine
							? await client.models.Routine.update({
									id: routine.id,
									...fields,
								})
							: await client.models.Routine.create(fields),
					);
					await saved();
				}}
				onDelete={
					routine
						? async () => {
								unwrap(await client.models.Routine.delete({ id: routine.id }));
								await saved();
							}
						: undefined
				}
			/>
		</Modal>
	);
}

function RoutinesPage() {
	const [editing, setEditing] = useState<Routine | "new" | null>(null);
	const { data: routines = [], isLoading } = useQuery({
		queryKey: ["routines"],
		queryFn: listRoutines,
	});

	return (
		<Section
			title="Routines"
			description="Recurring parts of the day. Add them to any day from the agenda; the planner will use them later too."
			action={
				<button
					type="button"
					onClick={() => setEditing("new")}
					className={primaryButtonClass}
				>
					Add routine
				</button>
			}
		>
			{isLoading && <p className="text-sm text-slate-400">Loading…</p>}
			{!isLoading && routines.length === 0 && (
				<p className="text-sm text-slate-400">
					No routines yet. Wake-up, meals, circle time and quiet time are good
					places to start.
				</p>
			)}
			<div className="space-y-2">
				{routines.map((routine) => (
					<div
						key={routine.id}
						className={`flex items-center gap-3 rounded-2xl border border-slate-100 p-3 ${
							routine.active === false ? "opacity-50" : ""
						}`}
					>
						<span
							className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xl ${colorClasses(routine.color).bg}`}
						>
							{routine.emoji}
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-semibold text-slate-700">
								{routine.title}
								{routine.active === false && (
									<span className="ml-2 text-xs font-normal text-slate-400">
										paused
									</span>
								)}
							</p>
							<p className="text-xs text-slate-500">
								{[
									formatTimeRange(routine.startTime, routine.endTime),
									describeDays(compact(routine.daysOfWeek)),
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setEditing(routine)}
							aria-label={`Edit ${routine.title}`}
							className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						>
							<Pencil className="h-4 w-4" />
						</button>
					</div>
				))}
			</div>

			{editing && (
				<RoutineEditor
					routine={editing === "new" ? null : editing}
					onDone={() => setEditing(null)}
				/>
			)}
		</Section>
	);
}
