import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import UserMenu from "~/components/UserMenu";

export const Route = createFileRoute("/_authed/planning")({
	component: PlanningLayout,
});

const TABS = [
	{ to: "/planning/routines", label: "Routines" },
	{ to: "/planning/units", label: "Learning" },
	{ to: "/planning/library", label: "Library" },
] as const;

function PlanningLayout() {
	return (
		<div className="h-full overflow-y-auto bg-slate-50">
			<header className="sticky top-0 z-10 bg-white px-4 pt-3 shadow-sm">
				<div className="mx-auto max-w-2xl">
					<div className="flex items-center justify-between">
						<Link
							to="/"
							className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
						>
							<ArrowLeft className="h-4 w-4" />
							Agenda
						</Link>
						<UserMenu />
					</div>
					<nav className="mt-2 flex gap-1">
						{TABS.map((tab) => (
							<Link
								key={tab.to}
								to={tab.to}
								className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-slate-400 transition hover:text-slate-600"
								activeProps={{
									className: "!border-indigo-600 !text-indigo-600",
								}}
							>
								{tab.label}
							</Link>
						))}
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-2xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}
