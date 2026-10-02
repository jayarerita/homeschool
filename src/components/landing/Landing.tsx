import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BookOpen,
	Bot,
	Code,
	Database,
	Palette,
	Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { GETTING_STARTED_URL, REPO_URL } from "~/lib/project";
import {
	LessonDemo,
	NotificationsDemo,
	PlannerDemo,
	SpeakerDemo,
	TerminalDemo,
	TutorDemo,
	WorksheetDemo,
} from "./demos";
import { useInView } from "./motion";

// The public home page: what the project is, what it can do, and how to run
// your own. Shown at / to anyone who isn't signed in, and always at /about.

function Reveal({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	const [ref, inView] = useInView<HTMLDivElement>();
	return (
		<div
			ref={ref}
			className={`${className} ${inView ? "lp-reveal-in" : "lp-reveal"}`}
		>
			{children}
		</div>
	);
}

function Showcase({
	eyebrow,
	title,
	children,
	demo,
	flip = false,
	tint,
}: {
	eyebrow: string;
	title: string;
	children: ReactNode;
	demo: ReactNode;
	flip?: boolean;
	tint: string;
}) {
	return (
		<section className="relative px-5 py-20 sm:py-28">
			<div
				className={`mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}
			>
				<Reveal>
					<p
						className={`text-sm font-semibold uppercase tracking-wider ${tint}`}
					>
						{eyebrow}
					</p>
					<h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
						{title}
					</h2>
					<div className="mt-5 space-y-4 text-lg leading-relaxed text-slate-600">
						{children}
					</div>
				</Reveal>
				<Reveal>{demo}</Reveal>
			</div>
		</section>
	);
}

const FEATURES = [
	{
		icon: Database,
		title: "Your data, your account",
		body: "Everything lives in DynamoDB and S3 in your own AWS account. No third-party service sees your family's plans.",
	},
	{
		icon: Bot,
		title: "Choose the AI",
		body: "Claude on Amazon Bedrock, Claude with your own API key, or Gemma on Bedrock. Switch any time from Settings.",
	},
	{
		icon: Users,
		title: "The whole household",
		body: "Parents and admins, kid mode on a shared tablet, and speaker devices, each seeing only what they should.",
	},
	{
		icon: Palette,
		title: "Made for your kids",
		body: "Names, colors, birthdays, interests, routines and learning units are set in the app, not in code.",
	},
	{
		icon: BookOpen,
		title: "A tutor that remembers",
		body: "Learner profiles and notes from each lesson shape what the tutor suggests and how it teaches next time.",
	},
	{
		icon: Code,
		title: "Open source",
		body: "MIT licensed, built on TanStack Start and AWS Amplify Gen 2. Read it, fork it, make it yours.",
	},
];

export default function Landing() {
	return (
		<div className="min-h-screen overflow-x-hidden bg-white text-slate-800">
			<header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur">
				<nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
					<a
						href="#top"
						className="flex items-center gap-2 text-lg font-bold text-slate-900"
					>
						<span className="text-2xl">🌱</span> Homeschool
					</a>
					<div className="ml-auto hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
						<a href="#features" className="hover:text-slate-900">
							Features
						</a>
						<a href="#get-started" className="hover:text-slate-900">
							Get started
						</a>
						<a href={REPO_URL} className="hover:text-slate-900">
							GitHub
						</a>
					</div>
					<Link
						to="/login"
						className="ml-auto rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 sm:ml-0"
					>
						Sign in
					</Link>
				</nav>
			</header>

			<section id="top" className="relative px-5 pb-20 pt-16 sm:pt-24">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
				>
					<div className="lp-blob absolute -left-24 top-10 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />
					<div
						className="lp-blob absolute right-0 top-40 h-96 w-96 rounded-full bg-rose-200/50 blur-3xl"
						style={{ animationDelay: "-6s" }}
					/>
					<div
						className="lp-blob absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-100/70 blur-3xl"
						style={{ animationDelay: "-12s" }}
					/>
				</div>
				<div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
					<div className="lp-rise">
						<p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-indigo-700 ring-1 ring-indigo-100">
							Open source · Runs in your own AWS account
						</p>
						<h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
							A calm school day, planned with a tutor who knows your kids.
						</h1>
						<p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">
							Homeschool is a family planner with an AI tutor built in. It
							drafts each day around your children's interests, teaches short
							spoken lessons, makes printable worksheets, and keeps everyone in
							the house on the same page.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<a
								href="#get-started"
								className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
							>
								Host your own <ArrowRight className="h-4 w-4" />
							</a>
							<a
								href={REPO_URL}
								className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:ring-slate-300"
							>
								<Code className="h-4 w-4" /> View on GitHub
							</a>
						</div>
					</div>
					<PlannerDemo />
				</div>
			</section>

			<div className="bg-slate-50">
				<Showcase
					eyebrow="The tutor"
					title="Ask for anything. It plans, adjusts and remembers."
					tint="text-indigo-600"
					demo={<TutorDemo />}
				>
					<p>
						Chat with a tutor that can see your calendar, routines, resources
						and each child's learner profile. Ask it to plan a unit, swap a
						rainy-day activity, or explain how to teach fractions to a
						six-year-old, and it updates the plan itself.
					</p>
					<p>
						Every night it drafts the days ahead for you to review, so mornings
						start with a plan instead of a blank page.
					</p>
				</Showcase>
			</div>

			<Showcase
				eyebrow="Kid mode"
				title="Hand over the tablet. The lesson talks back."
				tint="text-rose-600"
				demo={<LessonDemo />}
				flip
			>
				<p>
					Kid mode turns a parent's device into a simple, locked view of the
					child's day. Tapping “Let's go!” starts a full-screen lesson where the
					tutor works through the activity one small step at a time.
				</p>
				<p>
					Questions are read aloud with a natural voice, and kids can answer by
					talking. When they're done, the tutor notes how it went for next time.
				</p>
			</Showcase>

			<div className="bg-amber-50/60">
				<Showcase
					eyebrow="Worksheets"
					title="Printable practice, made for today's lesson."
					tint="text-amber-700"
					demo={<WorksheetDemo />}
				>
					<p>
						Ask for tracing, counting, matching or coloring pages and the tutor
						designs one around what you're studying, attaches it to the
						activity, and it's ready to print.
					</p>
				</Showcase>
			</div>

			<Showcase
				eyebrow="Speaker device"
				title="A kitchen speaker for curious questions."
				tint="text-sky-600"
				demo={<SpeakerDemo />}
				flip
			>
				<p>
					Turn a spare tablet, an old phone or a Raspberry Pi with a screen into
					the household's speaker. It shows the time and what's on now, and
					anyone can tap to ask the tutor a question out loud.
				</p>
				<p>
					Speaker accounts see only the speaker screen, and parents can read
					every conversation.
				</p>
			</Showcase>

			<div className="bg-gradient-to-b from-indigo-50/70 to-white">
				<Showcase
					eyebrow="Notifications"
					title="Reminders at the right moment."
					tint="text-violet-600"
					demo={<NotificationsDemo />}
				>
					<p>
						Get a nudge when tomorrow's draft is ready, a list of materials to
						gather the night before, a quick check-in on how an activity went,
						and a weekly preview, by push notification or email, with quiet
						hours you control.
					</p>
				</Showcase>
			</div>

			<section id="features" className="px-5 py-20 sm:py-28">
				<div className="mx-auto max-w-6xl">
					<Reveal className="mx-auto max-w-2xl text-center">
						<h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
							Built to be hosted by families, not a company
						</h2>
						<p className="mt-4 text-lg text-slate-600">
							One deployment serves one household. You run it, you own it.
						</p>
					</Reveal>
					<div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{FEATURES.map(({ icon: Icon, title, body }) => (
							<Reveal key={title}>
								<div className="h-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
									<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
										<Icon className="h-5 w-5" />
									</span>
									<h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
									<p className="mt-2 text-slate-600">{body}</p>
								</div>
							</Reveal>
						))}
					</div>
				</div>
			</section>

			<section
				id="get-started"
				className="bg-slate-900 px-5 py-20 text-white sm:py-28"
			>
				<div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
					<Reveal>
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							Get started in an afternoon
						</h2>
						<ol className="mt-8 space-y-6">
							{[
								[
									"Set up AWS",
									"You need Node.js 20+, an AWS account and local AWS credentials. Costs for one family are small and mostly pay-per-use.",
								],
								[
									"Deploy the backend",
									"Clone the repository and run the Amplify sandbox. It creates sign-in, the database, file storage and the tutor in your account.",
								],
								[
									"Sign up first",
									"The first person to sign up becomes the household admin. Add your children, choose the AI, and invite the rest of the family.",
								],
							].map(([title, body], i) => (
								<li key={title} className="flex gap-4">
									<span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 font-bold">
										{i + 1}
									</span>
									<div>
										<p className="font-semibold">{title}</p>
										<p className="mt-1 text-slate-300">{body}</p>
									</div>
								</li>
							))}
						</ol>
						<div className="mt-10 flex flex-wrap gap-3">
							<a
								href={GETTING_STARTED_URL}
								className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-indigo-50"
							>
								Read the setup guide <ArrowRight className="h-4 w-4" />
							</a>
							<a
								href={REPO_URL}
								className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white ring-1 ring-white/30 transition hover:ring-white/60"
							>
								<Code className="h-4 w-4" /> Star or fork on GitHub
							</a>
						</div>
					</Reveal>
					<Reveal>
						<TerminalDemo />
					</Reveal>
				</div>
			</section>

			<footer className="px-5 py-10 text-sm text-slate-500">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2">
					<span className="flex items-center gap-2 font-semibold text-slate-700">
						<span className="text-lg">🌱</span> Homeschool
					</span>
					<span>MIT licensed</span>
					<a href={REPO_URL} className="hover:text-slate-800">
						GitHub
					</a>
					<Link to="/login" className="ml-auto hover:text-slate-800">
						Sign in to your household
					</Link>
				</div>
			</footer>
		</div>
	);
}
