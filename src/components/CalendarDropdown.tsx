import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number) {
	return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
	return new Date(year, month, 1).getDay();
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
}

export default function CalendarDropdown({
	date,
	onChange,
}: {
	date: Date;
	onChange: (d: Date) => void;
}) {
	const [open, setOpen] = useState(false);
	const [view, setView] = useState({
		year: date.getFullYear(),
		month: date.getMonth(),
	});
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleOutsideClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, []);

	const prevMonth = () =>
		setView((v) => {
			const d = new Date(v.year, v.month - 1, 1);
			return { year: d.getFullYear(), month: d.getMonth() };
		});

	const nextMonth = () =>
		setView((v) => {
			const d = new Date(v.year, v.month + 1, 1);
			return { year: d.getFullYear(), month: d.getMonth() };
		});

	const daysInMonth = getDaysInMonth(view.year, view.month);
	const firstDay = getFirstDayOfMonth(view.year, view.month);

	return (
		<div className="relative" ref={ref}>
			<div className="flex items-center gap-2">
				{/* Date display */}
				<div className="flex flex-1 items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5">
					<span className="text-sm font-semibold text-slate-700">
						{formatDate(date)}
					</span>
				</div>

				{/* Calendar toggle */}
				<button
					type="button"
					onClick={() => setOpen(!open)}
					aria-label="Open calendar"
					className="flex-shrink-0 rounded-xl bg-indigo-600 p-2.5 text-white shadow-md transition hover:bg-indigo-700 active:scale-95"
				>
					<CalendarDays className="h-5 w-5" />
				</button>
			</div>

			{/* Popover calendar */}
			{open && (
				<div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
					{/* Month navigation */}
					<div className="mb-3 flex items-center justify-between">
						<button
							type="button"
							onClick={prevMonth}
							className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<span className="text-sm font-bold text-slate-700">
							{MONTHS[view.month]} {view.year}
						</span>
						<button
							type="button"
							onClick={nextMonth}
							className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>

					{/* Day-of-week headers */}
					<div className="mb-1 grid grid-cols-7 text-center">
						{DAY_HEADERS.map((d) => (
							<span
								key={d}
								className="text-[10px] font-bold uppercase text-slate-400"
							>
								{d}
							</span>
						))}
					</div>

					{/* Day grid */}
					<div className="grid grid-cols-7 gap-y-1 text-center">
						{Array.from({ length: firstDay }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: empty filler cells
							<span key={`empty-${i}`} />
						))}
						{Array.from({ length: daysInMonth }).map((_, i) => {
							const day = i + 1;
							const isSelected =
								date.getFullYear() === view.year &&
								date.getMonth() === view.month &&
								date.getDate() === day;
							const isToday =
								new Date().getFullYear() === view.year &&
								new Date().getMonth() === view.month &&
								new Date().getDate() === day;

							return (
								<button
									key={day}
									type="button"
									onClick={() => {
										onChange(new Date(view.year, view.month, day));
										setOpen(false);
									}}
									className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition ${
										isSelected
											? "bg-indigo-600 text-white"
											: isToday
												? "border border-indigo-300 text-indigo-600 hover:bg-indigo-50"
												: "text-slate-700 hover:bg-indigo-50"
									}`}
								>
									{day}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
