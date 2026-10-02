import { Bell, Check, Mic, Printer, Sparkles, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { REPO_URL } from "~/lib/project";
import { useInView, useScript, useTypewriter } from "./motion";

// Animated, self-contained illustrations of the app for the landing page.
// The households, names and activities in them are made up.

const MAYA = "bg-rose-100 text-rose-700";
const OLLIE = "bg-sky-100 text-sky-700";

function Window({
	title,
	children,
	className = "",
}: {
	title: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-indigo-900/10 ${className}`}
		>
			<div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
				<span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
				<span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
				<span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
				<span className="ml-3 text-xs font-medium text-slate-400">{title}</span>
			</div>
			{children}
		</div>
	);
}

function SoundBars({
	active,
	light = false,
}: {
	active: boolean;
	light?: boolean;
}) {
	return (
		<span className="inline-flex h-5 items-end gap-0.5" aria-hidden>
			{[0, 1, 2, 3, 4].map((i) => (
				<span
					key={i}
					className={`w-1 rounded-full ${light ? "bg-white" : "bg-indigo-400"} ${active ? "lp-bar" : ""}`}
					style={{
						height: active ? undefined : 4,
						animationDelay: `${i * 0.12}s`,
					}}
				/>
			))}
		</span>
	);
}

function TypingDots() {
	return (
		<span className="inline-flex gap-1" aria-hidden>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="h-2 w-2 animate-bounce rounded-full bg-indigo-300"
					style={{ animationDelay: `${i * 0.15}s` }}
				/>
			))}
		</span>
	);
}

// The planner drafting a day, then the day getting done.
const PLAN = [
	{
		emoji: "🌿",
		title: "Nature walk: find 5 kinds of leaves",
		time: "9:00",
		kids: [MAYA, OLLIE],
		names: ["Maya", "Ollie"],
		color: "bg-emerald-50",
	},
	{
		emoji: "🔢",
		title: "Counting bean seeds",
		time: "10:00",
		kids: [MAYA],
		names: ["Maya"],
		color: "bg-amber-50",
	},
	{
		emoji: "📖",
		title: "Story time: The Little Acorn",
		time: "11:00",
		kids: [OLLIE],
		names: ["Ollie"],
		color: "bg-sky-50",
	},
	{
		emoji: "🎨",
		title: "Leaf rubbings",
		time: "1:00",
		kids: [MAYA, OLLIE],
		names: ["Maya", "Ollie"],
		color: "bg-rose-50",
	},
];
const PLAN_SCRIPT = [1400, 450, 450, 450, 900, 1300, 900, 3200];

export function PlannerDemo() {
	const [ref, inView] = useInView<HTMLDivElement>();
	const { step } = useScript(PLAN_SCRIPT, inView);
	const shown = Math.min(step, PLAN.length);
	const ready = step >= 5;
	const doneCount = step >= 7 ? 2 : step >= 6 ? 1 : 0;

	return (
		<div ref={ref} className="lp-float">
			<Window title="Daily agenda">
				<div className="p-5">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
								Tuesday
							</p>
							<p className="text-lg font-bold text-slate-800">October 6</p>
						</div>
						{ready ? (
							<span className="lp-pop inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
								<Sparkles className="h-3.5 w-3.5" /> Draft ready to review
							</span>
						) : (
							<span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
								<TypingDots /> Planning
							</span>
						)}
					</div>
					<div className="mt-4 space-y-2.5">
						{PLAN.map((item, i) => (
							<div
								key={item.title}
								className={`flex items-center gap-3 rounded-xl p-3 ${item.color} ${i < shown ? "lp-rise" : "invisible"}`}
							>
								<span className="text-2xl">{item.emoji}</span>
								<div className="min-w-0 flex-1">
									<p
										className={`truncate text-sm font-semibold ${i < doneCount ? "text-slate-400 line-through" : "text-slate-800"}`}
									>
										{item.title}
									</p>
									<div className="mt-1 flex gap-1">
										<span className="text-xs text-slate-500">{item.time}</span>
										{item.names.map((n, k) => (
											<span
												key={n}
												className={`rounded-full px-1.5 text-[10px] font-semibold ${item.kids[k]}`}
											>
												{n}
											</span>
										))}
									</div>
								</div>
								<span
									className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${i < doneCount ? "lp-pop border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}
								>
									{i < doneCount && <Check className="h-3.5 w-3.5" />}
								</span>
							</div>
						))}
					</div>
				</div>
			</Window>
		</div>
	);
}

// A parent asking the tutor, which answers and acts on the plan.
const TUTOR_REPLY =
	"Let's sprout beans in a jar! Maya can count and sketch them each morning, and Ollie can be in charge of watering. I'll add it to Thursday.";
const TUTOR_SCRIPT = [1000, 1300, 3800, 700, 3200];

export function TutorDemo() {
	const [ref, inView] = useInView<HTMLDivElement>();
	const { step } = useScript(TUTOR_SCRIPT, inView);
	const reply = useTypewriter(TUTOR_REPLY, step >= 2);

	return (
		<div ref={ref}>
			<Window title="Tutor">
				<div className="flex min-h-[19rem] flex-col gap-3 p-5">
					<div className="lp-rise ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white">
						Can you plan something hands-on about seeds for Thursday?
					</div>
					{step === 1 && (
						<div className="w-fit rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
							<TypingDots />
						</div>
					)}
					{step >= 2 && (
						<div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-700">
							{reply}
							{reply.length < TUTOR_REPLY.length && (
								<span className="lp-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-slate-500" />
							)}
						</div>
					)}
					<div className="flex flex-wrap gap-2">
						{step >= 3 && (
							<span className="lp-pop inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
								📅 Added “Bean sprout jar” to Thursday
							</span>
						)}
						{step >= 4 && (
							<span className="lp-pop inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
								📝 Made a seed-counting worksheet
							</span>
						)}
					</div>
				</div>
			</Window>
		</div>
	);
}

// Kid mode: a big card, then a spoken lesson.
const LESSON_SCRIPT = [1500, 500, 2600, 1600, 900, 2800];

export function LessonDemo() {
	const [ref, inView] = useInView<HTMLDivElement>();
	const { step } = useScript(LESSON_SCRIPT, inView);
	const inLesson = step >= 2;

	return (
		<div ref={ref} className="mx-auto w-full max-w-xs">
			<div className="rounded-[2.5rem] border-8 border-slate-800 bg-rose-50 p-4 shadow-2xl shadow-rose-900/10">
				<div className="flex min-h-[22rem] flex-col">
					{!inLesson ? (
						<>
							<div className="flex items-center gap-2">
								<span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
									🦊
								</span>
								<p className="text-xl font-bold text-rose-700">Hi, Maya!</p>
							</div>
							<p className="mt-4 text-sm font-semibold text-slate-600">
								Today's adventures
							</p>
							<div className="mt-2 space-y-2.5">
								<div className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
									<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
										🔢
									</span>
									<p className="flex-1 text-sm font-bold text-slate-800">
										Counting bean seeds
									</p>
									<span
										className={`rounded-full bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition ${step === 1 ? "scale-90 bg-indigo-800" : ""}`}
									>
										Let's go!
									</span>
								</div>
								<div className="flex items-center gap-3 rounded-3xl bg-white p-3 opacity-60 shadow-sm">
									<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
										🌿
									</span>
									<p className="flex-1 text-sm font-bold text-slate-800">
										Nature walk
									</p>
									<span className="text-xl">✅</span>
								</div>
							</div>
						</>
					) : (
						<div className="lp-rise flex flex-1 flex-col">
							<div className="flex items-center gap-2">
								<span className="text-2xl">🔢</span>
								<p className="flex-1 font-bold text-slate-800">
									Counting bean seeds
								</p>
								<Volume2 className="h-5 w-5 text-slate-500" />
							</div>
							<div className="mt-4 flex-1 space-y-3">
								<div className="rounded-3xl bg-white p-4 text-base leading-snug text-slate-800 shadow-sm">
									How many seeds are in the jar? Let's count them together! 🫘
									<div className="mt-2">
										<SoundBars active={step === 2} />
									</div>
								</div>
								{step >= 4 && (
									<div className="lp-rise ml-auto w-fit rounded-3xl bg-indigo-500 px-4 py-2 text-base text-white">
										Seven!
									</div>
								)}
								{step >= 5 && (
									<div className="lp-rise rounded-3xl bg-white p-4 text-base text-slate-800 shadow-sm">
										Yes, seven seeds! 🌱 Can you find the biggest one?
										<div className="mt-2">
											<SoundBars active />
										</div>
									</div>
								)}
							</div>
							<div className="mt-3 flex items-center gap-3">
								<span
									className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white ${step === 3 ? "bg-red-500" : "bg-amber-500"}`}
								>
									{step === 3 && (
										<span className="lp-ring absolute inset-0 rounded-full bg-red-400" />
									)}
									<Mic className="relative h-6 w-6" />
								</span>
								<span className="text-sm text-slate-500">
									{step === 3 ? "Listening…" : "Talk or type…"}
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// A worksheet drawing itself, then printing.
const WORKSHEET_SCRIPT = [4200, 2200];
const SEEDS = [
	[0, 1, 2],
	[0, 1, 2, 3, 4],
	[0, 1, 2, 3],
];

export function WorksheetDemo() {
	const [ref, inView] = useInView<HTMLDivElement>();
	const { step, cycle } = useScript(WORKSHEET_SCRIPT, inView);

	return (
		<div ref={ref} className="relative mx-auto w-full max-w-sm">
			<div
				key={cycle}
				className={`relative rounded-lg bg-white p-6 shadow-2xl shadow-amber-900/10 ring-1 ring-slate-200 transition-transform duration-700 ${step === 1 ? "-translate-y-2 rotate-1" : ""}`}
			>
				<p className="text-center text-lg font-bold text-slate-800">
					Count the seeds
				</p>
				<p className="text-center text-xs text-slate-400">
					Name: ______________
				</p>
				<div className="mt-4 space-y-4">
					{SEEDS.map((row, r) => (
						<div key={row.length} className="flex items-center gap-3">
							<div className="flex flex-1 gap-2">
								{row.map((s) => (
									<span
										key={s}
										className="lp-pop h-5 w-4 rounded-[50%] bg-amber-700/80"
										style={{ animationDelay: `${0.3 + r * 0.5 + s * 0.12}s` }}
									/>
								))}
							</div>
							<span className="h-9 w-9 rounded-md border-2 border-dashed border-slate-300" />
						</div>
					))}
				</div>
				<svg viewBox="0 0 260 60" className="mt-4 w-full" aria-hidden>
					<title>Tracing</title>
					<path
						d="M10 45 Q 30 5 50 45 T 90 45 T 130 45 T 170 45 T 210 45 T 250 45"
						fill="none"
						stroke="#cbd5e1"
						strokeWidth="3"
						strokeDasharray="4 6"
						strokeLinecap="round"
					/>
					<path
						d="M10 45 Q 30 5 50 45 T 90 45 T 130 45 T 170 45 T 210 45 T 250 45"
						fill="none"
						stroke="#6366f1"
						strokeWidth="3"
						strokeLinecap="round"
						className="lp-draw"
						pathLength={1}
					/>
				</svg>
				<p className="mt-1 text-center text-[10px] text-slate-400">
					Trace the sprout's path
				</p>
			</div>
			<span
				className={`absolute -bottom-4 -right-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition ${step === 1 ? "scale-105 bg-indigo-600 text-white" : "bg-white text-slate-600"}`}
			>
				<Printer className="h-4 w-4" /> {step === 1 ? "Printing…" : "Print"}
			</span>
		</div>
	);
}

// The speaker screen on a tablet in the kitchen.
const SPEAKER_QUESTION = "Why do leaves change color?";
const SPEAKER_REPLY =
	"In fall, trees stop making green chlorophyll, so the yellow and orange that were hiding underneath finally get to show.";
const SPEAKER_SCRIPT = [1600, 1700, 900, 1000, 5200];

export function SpeakerDemo() {
	const [ref, inView] = useInView<HTMLDivElement>();
	const { step } = useScript(SPEAKER_SCRIPT, inView);
	const reply = useTypewriter(SPEAKER_REPLY, step >= 4, 30);
	const listening = step === 1;

	return (
		<div ref={ref} className="mx-auto w-full max-w-md">
			<div className="rounded-[2rem] border-[10px] border-slate-700 bg-slate-900 p-6 text-white shadow-2xl shadow-slate-900/30">
				<p className="text-center text-5xl font-bold tabular-nums">9:41</p>
				<p className="text-center text-sm text-slate-400">Tuesday, October 6</p>
				<div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3">
					<span className="text-3xl">🌿</span>
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
							Now · 9:00 – 10:00
						</p>
						<p className="text-sm font-bold">Nature walk</p>
					</div>
				</div>
				<div className="mt-4 min-h-[6.5rem]">
					{step >= 2 && (
						<p className="lp-rise text-sm text-slate-400">
							“{SPEAKER_QUESTION}”
						</p>
					)}
					{step === 3 && (
						<p className="mt-2 animate-pulse text-slate-400">Thinking…</p>
					)}
					{step >= 4 && <p className="mt-2 text-lg leading-snug">{reply}</p>}
				</div>
				<div className="mt-3 flex flex-col items-center gap-2">
					<span
						className={`relative flex h-20 w-20 items-center justify-center rounded-full ${listening ? "bg-red-500" : "bg-indigo-500"}`}
					>
						{listening && (
							<>
								<span className="lp-ring absolute inset-0 rounded-full bg-red-400" />
								<span
									className="lp-ring absolute inset-0 rounded-full bg-red-400"
									style={{ animationDelay: "0.5s" }}
								/>
							</>
						)}
						{step >= 4 ? (
							<SoundBars active light />
						) : (
							<Mic className="relative h-9 w-9" />
						)}
					</span>
					<p className="text-xs text-slate-400">
						{listening ? "Listening…" : step >= 4 ? "Speaking" : "Tap to talk"}
					</p>
				</div>
			</div>
		</div>
	);
}

// Notifications arriving through the week.
const NOTES = [
	{
		icon: "🌙",
		title: "Tomorrow is planned",
		body: "Review the draft for Wednesday.",
	},
	{
		icon: "🧺",
		title: "Gather for tomorrow",
		body: "A clear jar, paper towels, dried beans.",
	},
	{
		icon: "💬",
		title: "How did Leaf rubbings go?",
		body: "A quick note helps the tutor plan.",
	},
	{
		icon: "📬",
		title: "Next week at a glance",
		body: "Fall leaves unit, library day Thursday.",
	},
];
const NOTES_SCRIPT = [700, 900, 900, 900, 3000];

export function NotificationsDemo() {
	const [ref, inView] = useInView<HTMLDivElement>();
	const { step } = useScript(NOTES_SCRIPT, inView);

	return (
		<div ref={ref} className="mx-auto w-full max-w-sm space-y-3">
			{NOTES.map((n, i) => (
				<div
					key={n.title}
					className={`flex items-start gap-3 rounded-2xl bg-white/90 p-4 shadow-lg ring-1 ring-slate-200/70 backdrop-blur ${i < step ? "lp-slide" : "invisible"}`}
				>
					<span className="text-2xl">{n.icon}</span>
					<div className="min-w-0 flex-1">
						<div className="flex items-center justify-between gap-2">
							<p className="text-sm font-semibold text-slate-800">{n.title}</p>
							<Bell className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
						</div>
						<p className="text-sm text-slate-500">{n.body}</p>
					</div>
				</div>
			))}
		</div>
	);
}

// Typing the setup commands into a terminal.
const COMMANDS = [
	`git clone ${REPO_URL}`,
	"cd homeschool && npm install",
	"npm run amplify:sandbox",
	"npm run dev",
];
const TERMINAL_SCRIPT = [1600, 1300, 1600, 1000, 3000];

export function TerminalDemo({ commands = COMMANDS }: { commands?: string[] }) {
	const [ref, inView] = useInView<HTMLDivElement>();
	const { step } = useScript(TERMINAL_SCRIPT, inView);
	const current = useTypewriter(
		commands[Math.min(step, commands.length - 1)],
		inView,
		28,
	);

	return (
		<div
			ref={ref}
			className="overflow-hidden rounded-2xl bg-slate-900 font-mono text-sm text-slate-200 shadow-2xl"
		>
			<div className="flex gap-1.5 border-b border-white/10 px-4 py-2.5">
				<span className="h-2.5 w-2.5 rounded-full bg-white/20" />
				<span className="h-2.5 w-2.5 rounded-full bg-white/20" />
				<span className="h-2.5 w-2.5 rounded-full bg-white/20" />
			</div>
			<div className="min-h-[9.5rem] space-y-1.5 overflow-x-auto p-5">
				{commands.slice(0, Math.min(step, commands.length)).map((c) => (
					<p key={c} className="whitespace-nowrap">
						<span className="text-emerald-400">$</span> {c}
					</p>
				))}
				{step < commands.length ? (
					<p key={step} className="whitespace-nowrap">
						<span className="text-emerald-400">$</span> {current}
						<span className="lp-caret ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-slate-300" />
					</p>
				) : (
					<p className="lp-rise whitespace-nowrap text-emerald-300">
						➜ Local: http://localhost:3000
					</p>
				)}
			</div>
		</div>
	);
}
