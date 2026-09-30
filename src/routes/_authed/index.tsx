import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarRange,
	GraduationCap,
	Plus,
	Printer,
	Settings,
} from "lucide-react";
import { useState } from "react";
import ActivityForm, { toActivityDraft } from "~/components/ActivityForm";
import AgendaItemCard from "~/components/AgendaItem";
import CalendarDropdown from "~/components/CalendarDropdown";
import ChatPanel from "~/components/ChatPanel";
import DayContext from "~/components/DayContext";
import Modal from "~/components/Modal";
import UserMenu from "~/components/UserMenu";
import { type AgendaItem, getAgendaForDate, toDateKey } from "~/lib/agenda";
import {
	createAgendaItem,
	deleteAgendaItem,
	moveAgendaItem,
	updateAgendaItem,
} from "~/lib/agenda-mutations";
import { colorClasses } from "~/lib/colors";

export const Route = createFileRoute("/_authed/")({ component: HomeschoolApp });

function HomeschoolApp() {
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [activeChildId, setActiveChildId] = useState<string | null>(null);
	const [chatOpen, setChatOpen] = useState(false);
	const [editing, setEditing] = useState<AgendaItem | "new" | null>(null);
	const queryClient = useQueryClient();

	const dateKey = toDateKey(selectedDate);

	const { data, isLoading, error } = useQuery({
		queryKey: ["agenda", dateKey],
		queryFn: () => getAgendaForDate(dateKey),
	});

	const allChildren = data?.children ?? [];
	const rawItems = data?.items ?? [];
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: ["agenda", dateKey] });

	async function move(index: number, delta: -1 | 1) {
		await moveAgendaItem(rawItems, index, delta);
		await refresh();
	}

	// When a child filter is active, hide items assigned to other children
	const items = rawItems.filter((item) => {
		if (!activeChildId) return true;
		if (!item.childIds || item.childIds.length === 0) return true;
		return item.childIds.includes(activeChildId);
	});

	return (
		<div className="h-full bg-slate-50">
			<div
				className="flex h-full flex-col lg:flex-row lg:justify-center"
				id="orientation-div"
			>
				{/* ── Agenda column ── */}
				<div className="flex min-h-0 flex-1 flex-col lg:max-w-3xl lg:border-r lg:border-slate-200">
					{/* App header */}
					<header className="z-10 bg-white px-4 py-3 shadow-sm">
						<div className="mb-2.5 flex items-center justify-between">
							<span className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-600">
								<GraduationCap className="h-6 w-6 text-indigo-500" />
								Homeschool
							</span>
							<div className="flex items-center gap-1">
								<Link
									to="/planning"
									aria-label="Planning"
									title="Routines, learning units and resources"
									className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
								>
									<CalendarRange className="h-4 w-4" />
								</Link>
								<Link
									to="/settings"
									aria-label="Household settings"
									title="Household settings"
									className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
								>
									<Settings className="h-4 w-4" />
								</Link>
								<UserMenu />
							</div>
						</div>
						<CalendarDropdown date={selectedDate} onChange={setSelectedDate} />

						{/* Child filter tabs — only shown once children are set up */}
						{allChildren.length > 0 && (
							<div className="mt-3 flex gap-2">
								<button
									type="button"
									onClick={() => setActiveChildId(null)}
									className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
										activeChildId === null
											? "bg-slate-800 text-white"
											: "bg-slate-100 text-slate-500 hover:bg-slate-200"
									}`}
								>
									All
								</button>
								{allChildren.map((child) => {
									const colors = colorClasses(child.color);
									const isActive = activeChildId === child.id;
									return (
										<button
											key={child.id}
											type="button"
											onClick={() =>
												setActiveChildId(isActive ? null : child.id)
											}
											className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
												isActive
													? `${colors.activeBg} text-white`
													: `${colors.bg} ${colors.text} hover:opacity-80`
											}`}
										>
											{child.emoji && (
												<span className="mr-1">{child.emoji}</span>
											)}
											{child.name}
										</button>
									);
								})}
							</div>
						)}
					</header>

					{/* Agenda */}
					<main className="flex-1 overflow-y-auto px-4 py-4">
						<div className="mx-auto max-w-2xl">
							<div className="mb-4 flex items-center justify-between px-1">
								<h1 className="text-2xl font-bold text-slate-800">
									Daily Agenda
								</h1>
								<div className="flex items-center gap-1">
									<Link
										to="/print"
										search={{ date: dateKey }}
										target="_blank"
										className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
									>
										<Printer className="h-3.5 w-3.5" />
										Print
									</Link>
									<button
										type="button"
										onClick={() => setEditing("new")}
										className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
									>
										<Plus className="h-3.5 w-3.5" />
										Add
									</button>
								</div>
							</div>
							{data && (
								<DayContext
									dateKey={dateKey}
									items={rawItems}
									allChildren={allChildren}
									onChanged={refresh}
								/>
							)}
							{isLoading ? (
								<div className="flex items-center justify-center py-16 text-slate-400">
									Loading…
								</div>
							) : error ? (
								<div className="py-16 text-center text-sm text-red-600">
									Couldn't load this day: {error.message}
								</div>
							) : items.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
									<p className="font-medium text-slate-500">
										Nothing planned for this day yet
									</p>
									<p className="text-sm text-slate-400">
										Use Add, or add this day's routines above.
									</p>
								</div>
							) : (
								<div className="space-y-4 pb-4">
									{items.map((item) => {
										// Reordering works on the full day, so it's
										// only offered when no child filter is active.
										const index = rawItems.indexOf(item);
										const canMove = activeChildId === null;
										return (
											<AgendaItemCard
												key={item.id}
												item={item}
												allChildren={allChildren}
												activeChildId={activeChildId}
												onEdit={() => setEditing(item)}
												onMoveUp={
													canMove && index > 0
														? () => move(index, -1)
														: undefined
												}
												onMoveDown={
													canMove && index < rawItems.length - 1
														? () => move(index, 1)
														: undefined
												}
											/>
										);
									})}
								</div>
							)}
						</div>
					</main>

					{/* Chat buckle + drawer — mobile only */}
					<div className="lg:hidden">
						{chatOpen && (
							<div className="border-t border-slate-200 bg-white">
								<ChatPanel variant="footer" />
							</div>
						)}
						<div className="flex justify-end bg-white px-4 pb-4 pt-2">
							<button
								type="button"
								onClick={() => setChatOpen((o) => !o)}
								className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-indigo-700 active:scale-95"
							>
								<GraduationCap className="h-4 w-4" />
								Tutor
							</button>
						</div>
					</div>
				</div>

				{/* ── Chat sidebar — desktop only ── */}
				<aside className="hidden lg:flex lg:w-96 lg:flex-col xl:w-[420px]">
					<ChatPanel variant="sidebar" />
				</aside>
			</div>

			{editing && (
				<Modal
					title={editing === "new" ? "Add activity" : "Edit activity"}
					onClose={() => setEditing(null)}
				>
					<ActivityForm
						initial={toActivityDraft(editing === "new" ? undefined : editing)}
						household={allChildren}
						submitLabel={editing === "new" ? "Add" : "Save"}
						onCancel={() => setEditing(null)}
						onSubmit={async (draft) => {
							if (editing === "new") {
								await createAgendaItem(dateKey, rawItems, draft);
							} else {
								await updateAgendaItem(editing, rawItems, draft);
							}
							await refresh();
							setEditing(null);
						}}
						onDelete={
							editing === "new"
								? undefined
								: async () => {
										await deleteAgendaItem(editing.id);
										await refresh();
										setEditing(null);
									}
						}
					/>
				</Modal>
			)}
		</div>
	);
}
