import { LogOut } from "lucide-react";
import { useAuthContext } from "~/hooks/useAuth";

export default function UserMenu() {
	const { user, logout } = useAuthContext();

	return (
		<div className="flex items-center gap-2 text-xs text-slate-400">
			<span className="hidden sm:inline">{user?.signInDetails?.loginId}</span>
			<button
				type="button"
				onClick={async () => {
					await logout();
					window.location.href = "/";
				}}
				aria-label="Sign out"
				title="Sign out"
				className="rounded-lg p-1.5 transition hover:bg-slate-100 hover:text-slate-600"
			>
				<LogOut className="h-4 w-4" />
			</button>
		</div>
	);
}
