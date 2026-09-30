import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Printer } from "lucide-react";
import { formatDisplayDate, getAgendaForDate, toDateKey } from "~/lib/agenda";

export const Route = createFileRoute("/_authed/print")({
	validateSearch: (search: Record<string, unknown>) => ({
		date: typeof search.date === "string" ? search.date : undefined,
	}),
	component: PrintPage,
});

function PrintPage() {
	const { date } = Route.useSearch();
	const dateKey = date ?? toDateKey(new Date());

	const { data: agendaItems, isLoading } = useQuery({
		queryKey: ["agenda", dateKey],
		queryFn: () => getAgendaForDate(dateKey),
	});

	const items = agendaItems?.items ?? [];

	return (
		<>
			{/* Print button — hidden when printing */}
			<div className="no-print fixed right-6 top-6 z-50">
				<button
					type="button"
					onClick={() => window.print()}
					className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 active:scale-95"
				>
					<Printer className="h-4 w-4" />
					Print
				</button>
			</div>

			<div className="print-page mx-auto max-w-2xl px-6 font-sans">
				{/* Header */}
				<div className="mb-5 border-b-2 border-indigo-200 pb-4 flex items-start gap-4">
					<GraduationCap className="h-16 w-16 flex-shrink-0 text-indigo-400" />
					<div>
						<p className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-400">
							Daily Schedule
						</p>
						<h1 className="text-3xl font-bold text-slate-800">
							{formatDisplayDate(dateKey)}
						</h1>
						<p className="mt-1 text-sm text-slate-400">Homeschool Agenda</p>
					</div>
				</div>

				{/* Agenda list */}
				{isLoading ? (
					<p className="text-slate-400">Loading…</p>
				) : items.length === 0 ? (
					<p className="text-slate-400">Nothing planned for this day.</p>
				) : (
					<ol className="space-y-0">
						{items.map((item, index) => (
							<li
								key={item.id}
								className="group relative flex gap-2 print-item"
							>
								{/* Timeline spine */}
								<div className="flex flex-col items-center">
									<div
										className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-base ${item.iconBg}`}
									>
										{item.emoji}
									</div>
									{index < items.length - 1 && (
										<div className="mt-0.5 w-px flex-1 bg-slate-200" />
									)}
								</div>

								{/* Content — time+title left, description right */}
								<div className="min-w-0 flex-1 pb-3 flex gap-4 items-baseline">
									<div className="w-36 flex-shrink-0">
										{item.time && (
											<span className="block text-[10px] font-semibold tracking-wide text-indigo-400 uppercase leading-none mb-0.5">
												{item.time}
											</span>
										)}
										<h2 className="text-sm font-bold text-slate-800 leading-snug">
											{item.title}
										</h2>
									</div>
									{item.description && (
										<p className="text-sm leading-snug text-slate-500 flex-1">
											{item.description}
										</p>
									)}
								</div>
							</li>
						))}
					</ol>
				)}

				{/* Footer */}
				<div className="mt-6 border-t border-slate-200 pt-3 text-center text-xs text-slate-300">
					Printed from Homeschool &mdash; {formatDisplayDate(dateKey)}
				</div>
			</div>

			<style>{`
				@media print {
					.no-print { display: none !important; }

					@page {
						margin: 0.75in 0.65in;
						size: letter portrait;
					}

					body {
						-webkit-print-color-adjust: exact;
						print-color-adjust: exact;
					}

					.print-page {
						max-width: 100%;
						padding: 0;
					}

					.print-item {
						break-inside: avoid;
					}
				}
			`}</style>
		</>
	);
}
