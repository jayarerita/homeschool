import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Mic, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useConversationMessages } from "~/hooks/useConversationMessages";
import { useSpeechInput } from "~/hooks/useSpeech";
import { useAuthorName } from "~/hooks/useTutorChat";
import {
	type AgendaItem,
	formatTimeRange,
	listChildren,
	toDateKey,
} from "~/lib/agenda";
import { client, unwrap } from "~/lib/data-client";
import { deviceConversationFor, nowAndNext } from "~/lib/device";
import { isStalled, postMessage, requestReply } from "~/lib/tutor";
import { speakText, stopSpeaking } from "~/lib/voice";

export const Route = createFileRoute("/_authed/device")({
	component: SpeakerScreen,
});

function useClock() {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 15_000);
		return () => clearInterval(timer);
	}, []);
	return now;
}

function hhmm(date: Date): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function ActivityCard({
	label,
	item,
	childNames,
}: {
	label: string;
	item: AgendaItem;
	childNames: string;
}) {
	const time = formatTimeRange(item.startTime, item.endTime);
	return (
		<div className="flex items-center gap-4 rounded-3xl bg-white/10 p-5">
			<span className="text-5xl">{item.emoji || "⭐"}</span>
			<div className="min-w-0">
				<p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
					{label}
					{time && ` · ${time}`}
				</p>
				<p className="truncate text-2xl font-bold">{item.title}</p>
				{childNames && <p className="text-indigo-200">{childNames}</p>}
			</div>
		</div>
	);
}

// The household speaker: a spare tablet, phone or Raspberry Pi with a screen,
// signed in as a Device member. It shows the time and what's on now, and
// anyone in the room can tap to ask the tutor something out loud.
function SpeakerScreen() {
	const clock = useClock();
	const today = toDateKey(clock);
	const authorName = useAuthorName();
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [heard, setHeard] = useState<string | null>(null);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { data: day } = useQuery({
		queryKey: ["device-agenda", today],
		queryFn: async () => {
			const [children, items] = await Promise.all([
				listChildren(),
				client.models.AgendaItem.agendaItemsByDate(
					{ date: today },
					{ sortDirection: "ASC", limit: 1000 },
				).then(unwrap),
			]);
			return { children, items };
		},
		refetchInterval: 5 * 60_000,
	});
	const { now: current, next } = nowAndNext(day?.items ?? [], hhmm(clock));
	const namesFor = (item: AgendaItem) =>
		(item.childIds ?? [])
			.map((id) => day?.children.find((c) => c.id === id)?.name)
			.filter(Boolean)
			.join(" & ");

	useEffect(() => {
		let cancelled = false;
		deviceConversationFor(today)
			.then((id) => !cancelled && setConversationId(id))
			.catch((e) => !cancelled && setError((e as Error).message));
		return () => {
			cancelled = true;
		};
	}, [today]);

	const {
		messages,
		now,
		busy,
		error: liveError,
	} = useConversationMessages(conversationId);

	async function ask(text: string) {
		const trimmed = text.trim();
		if (!trimmed || !conversationId || busy || sending) return;
		stopSpeaking();
		setHeard(trimmed);
		setInput("");
		setSending(true);
		setError(null);
		try {
			await postMessage(conversationId, trimmed, authorName);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSending(false);
		}
	}

	const speech = useSpeechInput((text) => ask(text));

	// Speak each new reply once; don't replay the morning's when reloading.
	const spoken = useRef(new Set<string>());
	const loadedAt = useRef(Date.now());
	useEffect(() => {
		for (const m of messages) {
			if (m.role !== "assistant" || m.status !== "done") continue;
			if (spoken.current.has(m.id)) continue;
			spoken.current.add(m.id);
			const fresh = new Date(m.updatedAt).getTime() > loadedAt.current - 5000;
			if (fresh && m.text) void speakText(m.text);
		}
	}, [messages]);

	const reply = messages.findLast((m) => m.role === "assistant");
	const question = heard ?? messages.findLast((m) => m.role === "user")?.text;
	const failed = reply && (reply.status === "error" || isStalled(reply, now));

	return (
		<div className="flex h-full flex-col bg-slate-900 px-6 py-6 text-white">
			<div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
				<header className="text-center">
					<p className="text-7xl font-bold tabular-nums">
						{clock.toLocaleTimeString([], {
							hour: "numeric",
							minute: "2-digit",
						})}
					</p>
					<p className="mt-1 text-xl text-slate-300">
						{clock.toLocaleDateString([], {
							weekday: "long",
							month: "long",
							day: "numeric",
						})}
					</p>
				</header>

				<section className="mt-6 grid gap-3 sm:grid-cols-2">
					{current && (
						<ActivityCard
							label="Now"
							item={current}
							childNames={namesFor(current)}
						/>
					)}
					{next && (
						<ActivityCard
							label="Next"
							item={next}
							childNames={namesFor(next)}
						/>
					)}
					{day && !current && !next && (
						<p className="rounded-3xl bg-white/10 p-5 text-center text-xl text-slate-300 sm:col-span-2">
							Nothing else on the schedule today.
						</p>
					)}
				</section>

				<section className="mt-6 flex-1 overflow-y-auto" aria-live="polite">
					{question && <p className="text-xl text-slate-400">“{question}”</p>}
					{reply && question && (
						<div className="mt-3 text-3xl leading-snug">
							{failed ? (
								<button
									type="button"
									onClick={() =>
										requestReply(reply.conversationId, reply.sentAt)
									}
									className="inline-flex items-center gap-2 text-red-300"
								>
									<RotateCcw className="h-7 w-7" /> I couldn't answer. Try
									again?
								</button>
							) : reply.text ? (
								<p className="whitespace-pre-wrap">{reply.text}</p>
							) : (
								<p className="animate-pulse text-slate-400">Thinking…</p>
							)}
						</div>
					)}
					{(error || liveError || speech.error) && (
						<p className="mt-3 text-lg text-amber-300">
							{error ?? liveError ?? speech.error}
						</p>
					)}
				</section>

				<footer className="mt-4 flex flex-col items-center gap-4">
					{speech.supported ? (
						<button
							type="button"
							onClick={speech.listening ? speech.stop : speech.start}
							disabled={!conversationId || busy || sending}
							aria-label={speech.listening ? "Stop listening" : "Tap to talk"}
							className={`flex h-36 w-36 items-center justify-center rounded-full shadow-2xl transition active:scale-95 disabled:opacity-50 ${
								speech.listening
									? "animate-pulse bg-red-500"
									: "bg-indigo-500 hover:bg-indigo-400"
							}`}
						>
							<Mic className="h-16 w-16" />
						</button>
					) : null}
					<p className="text-slate-400">
						{speech.listening
							? "Listening…"
							: speech.supported
								? "Tap to talk"
								: "Type a question"}
					</p>
					<form
						className="relative w-full max-w-xl"
						onSubmit={(e) => {
							e.preventDefault();
							ask(input);
						}}
					>
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Or type here…"
							aria-label="Ask the tutor"
							className="w-full rounded-full bg-white/10 py-3 pl-5 pr-12 text-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
						/>
						<button
							type="submit"
							disabled={!input.trim() || !conversationId || busy || sending}
							aria-label="Send"
							className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-indigo-300 disabled:opacity-40"
						>
							<Send className="h-5 w-5" />
						</button>
					</form>
				</footer>
			</div>
		</div>
	);
}
