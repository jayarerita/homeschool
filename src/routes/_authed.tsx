import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Login } from "~/components/Login";
import { AuthContext, useAuth } from "~/hooks/useAuth";
import { allowedInKidMode, getKidMode } from "~/lib/kid-mode";

// While kid mode is on, the device stays on that child's view and lessons;
// anything else (a typed URL, a reload elsewhere) goes back to the child.
function KidModeLock() {
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	useEffect(() => {
		const kid = getKidMode();
		if (kid && !allowedInKidMode(pathname, kid.childId)) {
			navigate({
				to: "/kid/$childId",
				params: { childId: kid.childId },
				replace: true,
			});
		}
	}, [pathname, navigate]);
	return null;
}

// A speaker device account only ever shows the speaker screen.
function DeviceLock() {
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	useEffect(() => {
		if (pathname !== "/device") navigate({ to: "/device", replace: true });
	}, [pathname, navigate]);
	return null;
}

export const Route = createFileRoute("/_authed")({
	component: AuthGuard,
});

function AuthGuard() {
	const auth = useAuth();
	const { isAuthenticated, isLoading, isParent, isDevice, user, logout } = auth;

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

	// Kids use the app through kid mode on a parent's device, and speaker
	// devices get the speaker screen. CHILD accounts have no experience of
	// their own yet. See docs/ARCHITECTURE.md.
	if (!isParent && !isDevice) {
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

	return (
		<AuthContext.Provider value={auth}>
			{isParent ? <KidModeLock /> : <DeviceLock />}
			<Outlet />
		</AuthContext.Provider>
	);
}
