import { GROUPS } from "../../auth/groups";

type Caller = {
	username?: string | null;
	groups?: readonly string[] | null;
};

// Who may get a tutor reply in a conversation. Parents may use any
// conversation; anyone else (the speaker device) only conversations they
// created. Without this, a device could ask for a reply in a parent's
// planning conversation and read the history back through it.
export function canUseConversation(
	caller: Caller | undefined,
	conversation: { owner?: string | null },
): boolean {
	if (caller?.groups?.includes(GROUPS.parent)) return true;
	if (!caller?.username || !conversation.owner) return false;
	// Owner fields are stored as "sub::username" but read back as the username.
	return conversation.owner.split("::").at(-1) === caller.username;
}
