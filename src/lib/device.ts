import { createConversation } from "./tutor";

type Timed = {
	startTime?: string | null;
	endTime?: string | null;
	status?: string | null;
};

// What's happening now and next, by start/end times ("HH:mm"). An activity
// without an end time lasts until the one after it starts, or an hour if
// it's the day's last.
export function nowAndNext<T extends Timed>(
	items: readonly T[],
	nowHHmm: string,
): { now?: T; next?: T } {
	const timed = items
		.filter((i) => i.startTime && i.status !== "skipped")
		.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
	const ends = timed.map(
		(item, i) =>
			item.endTime ?? timed[i + 1]?.startTime ?? addHour(item.startTime ?? ""),
	);
	const next = timed.find((i) => (i.startTime ?? "") > nowHHmm);
	const now = timed.findLast(
		(item, i) => (item.startTime ?? "") <= nowHHmm && nowHHmm < ends[i],
	);
	return { now, next };
}

function addHour(hhmm: string): string {
	const [h, m] = hhmm.split(":");
	return `${String(Math.min(Number(h) + 1, 24)).padStart(2, "0")}:${m}`;
}

// The speaker keeps one conversation per day, so follow-ups have context.
export async function deviceConversationFor(date: string): Promise<string> {
	const key = `device-conversation:${date}`;
	try {
		const saved = localStorage.getItem(key);
		if (saved) return saved;
	} catch {}
	const conversation = await createConversation({
		mode: "device",
		title: `Speaker · ${date}`,
		lastMessageAt: new Date().toISOString(),
	});
	try {
		localStorage.setItem(key, conversation.id);
	} catch {}
	return conversation.id;
}
