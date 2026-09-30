import type Anthropic from "@anthropic-ai/sdk";
import {
	GetObjectCommand,
	NoSuchKey,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

// Each completed turn's API messages (user message, context, assistant
// replies, tool results) are stored verbatim so later turns can replay the
// exact same history - required for thinking blocks and prompt caching.
export type TurnMessages = Anthropic.Beta.BetaMessageParam[];

const s3 = new S3Client();
const Bucket = process.env.HOUSEHOLD_BUCKET;

function key(conversationId: string, messageId: string): string {
	return `tutor/${conversationId}/${messageId}.json`;
}

export async function saveTurn(
	conversationId: string,
	messageId: string,
	messages: TurnMessages,
): Promise<void> {
	await s3.send(
		new PutObjectCommand({
			Bucket,
			Key: key(conversationId, messageId),
			Body: JSON.stringify(messages),
			ContentType: "application/json",
		}),
	);
}

async function loadTurn(
	conversationId: string,
	messageId: string,
): Promise<TurnMessages> {
	try {
		const object = await s3.send(
			new GetObjectCommand({ Bucket, Key: key(conversationId, messageId) }),
		);
		return JSON.parse(await (object.Body?.transformToString() ?? "[]"));
	} catch (e) {
		// Turns that failed are never saved, so they drop out of the history.
		if (e instanceof NoSuchKey) return [];
		throw e;
	}
}

// The conversation so far, oldest turn first.
export async function loadHistory(
	conversationId: string,
	assistantMessageIds: string[],
): Promise<TurnMessages> {
	const turns = await Promise.all(
		assistantMessageIds.map((id) => loadTurn(conversationId, id)),
	);
	return turns.flat();
}
