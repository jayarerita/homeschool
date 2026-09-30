import {
	type AuthUser,
	fetchAuthSession,
	getCurrentUser,
	signOut,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { GROUPS, type Group } from "../../amplify/auth/groups";

export interface AuthState {
	user: AuthUser | null;
	groups: Group[];
	isLoading: boolean;
	isAuthenticated: boolean;
}

const SIGNED_OUT: AuthState = {
	user: null,
	groups: [],
	isLoading: false,
	isAuthenticated: false,
};

export function useAuth() {
	const [authState, setAuthState] = useState<AuthState>({
		...SIGNED_OUT,
		isLoading: true,
	});

	// forceRefresh picks up group changes (e.g. the first-parent bootstrap that
	// runs right after confirmation) without re-login. Never force from the
	// tokenRefresh listener: a forced refresh emits tokenRefresh again.
	const checkAuthState = useCallback(async (forceRefresh = false) => {
		try {
			const user = await getCurrentUser();
			const session = await fetchAuthSession({ forceRefresh });
			const groups =
				(session.tokens?.accessToken.payload["cognito:groups"] as
					| Group[]
					| undefined) ?? [];
			setAuthState({ user, groups, isLoading: false, isAuthenticated: true });
		} catch {
			setAuthState(SIGNED_OUT);
		}
	}, []);

	useEffect(() => {
		checkAuthState(true);

		return Hub.listen("auth", ({ payload }) => {
			switch (payload.event) {
				case "signedIn":
					checkAuthState(true);
					break;
				case "tokenRefresh":
					checkAuthState();
					break;
				case "signedOut":
				case "tokenRefresh_failure":
					setAuthState(SIGNED_OUT);
					break;
			}
		});
	}, [checkAuthState]);

	const logout = useCallback(async () => {
		try {
			await signOut();
			setAuthState(SIGNED_OUT);
			return { success: true };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}, []);

	return {
		...authState,
		isParent: authState.groups.includes(GROUPS.parent),
		isAdmin: authState.groups.includes(GROUPS.admin),
		logout,
		checkAuthState,
	};
}

export type Auth = ReturnType<typeof useAuth>;

// Provided by the _authed layout so pages share one auth state instead of each
// calling useAuth (and refreshing tokens) on mount.
export const AuthContext = createContext<Auth | null>(null);

export function useAuthContext(): Auth {
	const auth = useContext(AuthContext);
	if (!auth) throw new Error("useAuthContext must be used inside _authed.");
	return auth;
}
