import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuthContext } from "~/hooks/useAuth";
import { useConversationMessages } from "~/hooks/useConversationMessages";
import {
	createConversation,
	listConversations,
	postMessage,
	requestReply,
	type TutorMessage,
} from "~/lib/tutor";

export { type Conversation, isStalled, type TutorMessage } from "~/lib/tutor";

const STORAGE_KEY = "tutor-conversation";

function rememberConversation(id: string | null) {
	try {
		if (id) localStorage.setItem(STORAGE_KEY, id);
		else localStorage.removeItem(STORAGE_KEY);
	} catch {}
}

function recalledConversation(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

export function useAuthorName(): string {
	const { user } = useAuthContext();
	return user?.signInDetails?.loginId?.split("@")[0] ?? "A parent";
}

// Chat state for the tutor panel: which conversation is open, its live
// messages, and sending. Lessons open in their own full-screen view.
export function useTutorChat() {
	const queryClient = useQueryClient();
	const authorName = useAuthorName();

	const { data: conversations = [] } = useQuery({
		queryKey: ["conversations"],
		queryFn: listConversations,
	});
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Only reopen a conversation automatically once, on load; after that a
	// null conversation means the parent chose "New conversation".
	const [restored, setRestored] = useState(false);
	const live = useConversationMessages(conversationId);

	// Reopen the last conversation, or the most recent one.
	useEffect(() => {
		if (restored || conversations.length === 0) return;
		setRestored(true);
		if (conversationId) return;
		const recalled = recalledConversation();
		setConversationId(
			conversations.find((c) => c.id === recalled)?.id ??
				conversations[0]?.id ??
				null,
		);
	}, [conversations, conversationId, restored]);

	const conversation =
		conversations.find((c) => c.id === conversationId) ?? null;

	function select(id: string | null) {
		setRestored(true);
		setConversationId(id);
		rememberConversation(id);
		setError(null);
	}

	function startNew() {
		select(null);
	}

	async function send(text: string) {
		setError(null);
		try {
			let id = conversationId;
			if (!id) {
				id = (
					await createConversation({
						mode: "parent",
						title: text.slice(0, 80),
						lastMessageAt: new Date().toISOString(),
					})
				).id;
				await queryClient.invalidateQueries({ queryKey: ["conversations"] });
				select(id);
			}
			await postMessage(id, text, authorName);
			queryClient.invalidateQueries({ queryKey: ["conversations"] });
		} catch (e) {
			setError((e as Error).message);
		}
	}

	// Asks again after a failed reply. The failed turn was never saved, so the
	// tutor answers the same question fresh.
	async function retry(failed: TutorMessage) {
		setError(null);
		try {
			await requestReply(failed.conversationId, failed.sentAt);
		} catch (e) {
			setError((e as Error).message);
		}
	}

	return {
		conversations,
		conversation,
		messages: live.messages,
		now: live.now,
		busy: live.busy,
		error: error ?? live.error,
		select,
		startNew,
		send,
		retry,
	};
}

export type TutorChat = ReturnType<typeof useTutorChat>;
