import type { AgendaItem } from "./agenda";
import { client, type Schema, unwrap } from "./data-client";

export type Conversation = Schema["Conversation"]["type"];
export type TutorMessage = Schema["TutorMessage"]["type"];

// A reply that hasn't changed for this long is treated as failed, so a
// backend problem can't lock the chat; the parent can try again.
const STALL_MS = 3 * 60 * 1000;

export function isStalled(message: TutorMessage, now: number): boolean {
	return (
		(message.status === "pending" || message.status === "streaming") &&
		now - new Date(message.updatedAt).getTime() > STALL_MS
	);
}

export function isWorking(message: TutorMessage, now: number): boolean {
	return (
		(message.status === "pending" || message.status === "streaming") &&
		!isStalled(message, now)
	);
}

function timeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export async function listConversations(): Promise<Conversation[]> {
	const conversations = unwrap(
		await client.models.Conversation.list({ limit: 1000 }),
	);
	return conversations.sort((a, b) =>
		(b.lastMessageAt ?? b.createdAt).localeCompare(
			a.lastMessageAt ?? a.createdAt,
		),
	);
}

export async function getConversation(
	id: string,
): Promise<Conversation | null> {
	return unwrap(await client.models.Conversation.get({ id }));
}

export async function createConversation(
	fields: Parameters<typeof client.models.Conversation.create>[0],
): Promise<Conversation> {
	const created = unwrap(await client.models.Conversation.create(fields));
	if (!created) throw new Error("Could not start a conversation.");
	return created;
}

// A lesson conversation about one activity, with one child.
export function createLessonConversation(
	item: AgendaItem,
	childId: string | null,
): Promise<Conversation> {
	return createConversation({
		mode: "lesson",
		title: item.title,
		agendaItemId: item.id,
		childId,
		lastMessageAt: new Date().toISOString(),
	});
}

// Adds an assistant placeholder right after `after` and asks the backend to
// fill it in; the reply streams into the placeholder.
export async function requestReply(
	conversationId: string,
	after: string,
): Promise<void> {
	const placeholder = unwrap(
		await client.models.TutorMessage.create({
			conversationId,
			sentAt: new Date(new Date(after).getTime() + 1).toISOString(),
			role: "assistant",
			status: "pending",
		}),
	);
	if (!placeholder) throw new Error("Could not reach the tutor.");
	unwrap(
		await client.mutations.runTutorTurn({
			conversationId,
			messageId: placeholder.id,
			timeZone: timeZone(),
		}),
	);
}

export async function postMessage(
	conversationId: string,
	text: string,
	authorName: string,
): Promise<void> {
	const sentAt = new Date().toISOString();
	unwrap(
		await client.models.TutorMessage.create({
			conversationId,
			sentAt,
			role: "user",
			text,
			authorName,
			status: "done",
		}),
	);
	unwrap(
		await client.models.Conversation.update({
			id: conversationId,
			lastMessageAt: sentAt,
		}),
	);
	await requestReply(conversationId, sentAt);
}
