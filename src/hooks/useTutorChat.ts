import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuthContext } from "~/hooks/useAuth";
import type { AgendaItem } from "~/lib/agenda";
import { client, type Schema, unwrap } from "~/lib/data-client";

export type Conversation = Schema["Conversation"]["type"];
export type TutorMessage = Schema["TutorMessage"]["type"];

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

async function listConversations(): Promise<Conversation[]> {
	const conversations = unwrap(
		await client.models.Conversation.list({ limit: 1000 }),
	);
	return conversations.sort((a, b) =>
		(b.lastMessageAt ?? b.createdAt).localeCompare(
			a.lastMessageAt ?? a.createdAt,
		),
	);
}

function timeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// A reply that hasn't changed for this long is treated as failed, so a
// backend problem can't lock the chat; the parent can try again.
const STALL_MS = 3 * 60 * 1000;

export function isStalled(message: TutorMessage, now: number): boolean {
	return (
		(message.status === "pending" || message.status === "streaming") &&
		now - new Date(message.updatedAt).getTime() > STALL_MS
	);
}

// Chat state for the tutor panel. Messages stream in through an AppSync
// subscription: the tutor Lambda writes its reply into the assistant message
// as it's generated.
export function useTutorChat() {
	const queryClient = useQueryClient();
	const { user } = useAuthContext();
	const authorName = user?.signInDetails?.loginId?.split("@")[0] ?? "A parent";

	const { data: conversations = [] } = useQuery({
		queryKey: ["conversations"],
		queryFn: listConversations,
	});
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [messages, setMessages] = useState<TutorMessage[]>([]);
	const [error, setError] = useState<string | null>(null);
	// Only reopen a conversation automatically once, on load; after that a
	// null conversation means the parent chose "New conversation".
	const [restored, setRestored] = useState(false);
	// Re-evaluates stalled replies as time passes.
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 15_000);
		return () => clearInterval(timer);
	}, []);

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

	useEffect(() => {
		setMessages([]);
		if (!conversationId) return;
		const subscription = client.models.TutorMessage.observeQuery({
			filter: { conversationId: { eq: conversationId } },
		}).subscribe({
			next: ({ items }) =>
				setMessages(
					[...items].sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
				),
			error: (e) => setError(String(e?.message ?? e)),
		});
		return () => subscription.unsubscribe();
	}, [conversationId]);

	const conversation =
		conversations.find((c) => c.id === conversationId) ?? null;
	const busy = messages.some(
		(m) =>
			(m.status === "pending" || m.status === "streaming") &&
			!isStalled(m, now),
	);

	function select(id: string | null) {
		setRestored(true);
		setConversationId(id);
		rememberConversation(id);
		setError(null);
	}

	function startNew() {
		select(null);
	}

	async function createConversation(
		fields: Parameters<typeof client.models.Conversation.create>[0],
	): Promise<Conversation> {
		const created = unwrap(await client.models.Conversation.create(fields));
		if (!created) throw new Error("Could not start a conversation.");
		await queryClient.invalidateQueries({ queryKey: ["conversations"] });
		select(created.id);
		return created;
	}

	// Adds an assistant placeholder right after `after` and asks the backend to
	// fill it in.
	async function requestReply(conversation: string, after: string) {
		const placeholder = unwrap(
			await client.models.TutorMessage.create({
				conversationId: conversation,
				sentAt: new Date(new Date(after).getTime() + 1).toISOString(),
				role: "assistant",
				status: "pending",
			}),
		);
		if (!placeholder) throw new Error("Could not reach the tutor.");
		unwrap(
			await client.mutations.runTutorTurn({
				conversationId: conversation,
				messageId: placeholder.id,
				timeZone: timeZone(),
			}),
		);
	}

	async function send(text: string) {
		setError(null);
		try {
			const id =
				conversationId ??
				(
					await createConversation({
						mode: "parent",
						title: text.slice(0, 80),
						lastMessageAt: new Date().toISOString(),
					})
				).id;
			const sentAt = new Date().toISOString();
			unwrap(
				await client.models.TutorMessage.create({
					conversationId: id,
					sentAt,
					role: "user",
					text,
					authorName,
					status: "done",
				}),
			);
			unwrap(
				await client.models.Conversation.update({
					id,
					lastMessageAt: sentAt,
				}),
			);
			await requestReply(id, sentAt);
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

	// Opens a lesson conversation about one activity, with one child.
	async function startLesson(item: AgendaItem, childId: string | null) {
		setError(null);
		try {
			await createConversation({
				mode: "lesson",
				title: item.title,
				agendaItemId: item.id,
				childId,
				lastMessageAt: new Date().toISOString(),
			});
		} catch (e) {
			setError((e as Error).message);
		}
	}

	return {
		conversations,
		conversation,
		messages,
		now,
		busy,
		error,
		select,
		startNew,
		startLesson,
		send,
		retry,
	};
}

export type TutorChat = ReturnType<typeof useTutorChat>;
