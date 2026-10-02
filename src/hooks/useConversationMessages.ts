import { useEffect, useState } from "react";
import { client } from "~/lib/data-client";
import { isWorking, type TutorMessage } from "~/lib/tutor";

// Live messages for one conversation. The tutor Lambda writes its reply into
// the assistant message as it's generated; observeQuery delivers each update.
export function useConversationMessages(conversationId: string | null) {
	const [messages, setMessages] = useState<TutorMessage[]>([]);
	const [error, setError] = useState<string | null>(null);
	// Re-evaluates stalled replies as time passes.
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 15_000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		setMessages([]);
		setError(null);
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

	return {
		messages,
		now,
		busy: messages.some((m) => isWorking(m, now)),
		error,
	};
}
