import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import ChildrenSettings from "~/components/settings/ChildrenSettings";
import ImportSettings from "~/components/settings/ImportSettings";
import MembersSettings from "~/components/settings/MembersSettings";
import UserMenu from "~/components/UserMenu";
import { useAuthContext } from "~/hooks/useAuth";

export const Route = createFileRoute("/_authed/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const { isAdmin } = useAuthContext();

	return (
		<div className="h-full overflow-y-auto bg-slate-50">
			<header className="sticky top-0 z-10 bg-white px-4 py-3 shadow-sm">
				<div className="mx-auto flex max-w-2xl items-center justify-between">
					<Link
						to="/"
						className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
					>
						<ArrowLeft className="h-4 w-4" />
						Agenda
					</Link>
					<UserMenu />
				</div>
			</header>
			<main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
				<h1 className="px-1 text-2xl font-bold text-slate-800">Household</h1>
				<ChildrenSettings />
				{isAdmin && <MembersSettings />}
				<ImportSettings />
			</main>
		</div>
	);
}
