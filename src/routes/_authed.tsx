import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Login } from "~/components/Login";
import { useAuth } from "~/hooks/useAuth";

export const Route = createFileRoute("/_authed")({
	component: AuthGuard,
});

function AuthGuard() {
	const { isAuthenticated, isLoading, isParent, user, logout } = useAuth();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center text-slate-400">
				Loading…
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Login />;
	}

	// Kid and device experiences arrive in later phases; for now the app is
	// parent-only. See docs/ARCHITECTURE.md.
	if (!isParent) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
				<p className="text-lg font-semibold text-slate-700">
					Waiting for access
				</p>
				<p className="max-w-sm text-sm text-slate-500">
					{user?.signInDetails?.loginId ?? "Your account"} is signed in but
					hasn't been added to this household yet. Ask a parent to grant you
					access.
				</p>
				<button
					type="button"
					onClick={async () => {
						await logout();
						window.location.href = "/";
					}}
					className="text-sm font-medium text-indigo-600 hover:underline"
				>
					Sign out
				</button>
			</div>
		);
	}

	return <Outlet />;
}
