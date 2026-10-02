import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { listChildren } from "~/lib/agenda";
import { colorClasses } from "~/lib/colors";
import { setKidMode } from "~/lib/kid-mode";

export const Route = createFileRoute("/_authed/kid/")({
	component: KidPicker,
});

// A parent picks which child gets the device; kid mode then locks the app to
// that child's view until a parent unlocks it.
function KidPicker() {
	const navigate = useNavigate();
	const { data: children = [], isLoading } = useQuery({
		queryKey: ["children"],
		queryFn: listChildren,
	});
	const active = children.filter((c) => !c.archived);

	return (
		<div className="flex min-h-full flex-col bg-amber-50 px-6 py-6">
			<Link
				to="/"
				className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to planning
			</Link>
			<div className="mx-auto mt-10 w-full max-w-2xl text-center">
				<h1 className="text-3xl font-bold text-slate-800">Who's learning?</h1>
				<p className="mt-2 text-slate-500">
					The app will stay on their screen until a grown-up unlocks it.
				</p>
				{isLoading && <p className="mt-10 text-slate-400">Loading…</p>}
				{!isLoading && active.length === 0 && (
					<p className="mt-10 text-slate-500">
						Add children in{" "}
						<Link to="/settings" className="text-indigo-600 underline">
							Settings
						</Link>{" "}
						first.
					</p>
				)}
				<div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3">
					{active.map((child) => {
						const colors = colorClasses(child.color);
						return (
							<button
								key={child.id}
								type="button"
								onClick={() => {
									setKidMode(child.id);
									navigate({
										to: "/kid/$childId",
										params: { childId: child.id },
									});
								}}
								className={`flex flex-col items-center gap-3 rounded-[2rem] border-4 bg-white p-6 shadow-sm transition hover:scale-105 active:scale-95 ${colors.border}`}
							>
								<span
									className={`flex h-24 w-24 items-center justify-center rounded-full text-6xl ${colors.bg}`}
								>
									{child.emoji || child.name.charAt(0)}
								</span>
								<span className={`text-2xl font-bold ${colors.text}`}>
									{child.name}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
