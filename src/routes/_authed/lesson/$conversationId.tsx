import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	ChevronDown,
	Mic,
	RotateCcw,
	Send,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useConversationMessages } from "~/hooks/useConversationMessages";
import { useReadAloud, useSpeechInput } from "~/hooks/useSpeech";
import { useAuthorName } from "~/hooks/useTutorChat";
import { listChildren } from "~/lib/agenda";
import { colorClasses } from "~/lib/colors";
import { client, unwrap } from "~/lib/data-client";
import { getKidMode } from "~/lib/kid-mode";
import {
	getConversation,
	isStalled,
	postMessage,
	requestReply,
	type TutorMessage,
} from "~/lib/tutor";

export const Route = createFileRoute("/_authed/lesson/$conversationId")({
	component: LessonView,
});

const START = "Let's start!";
const DONE = "We're all done!";

function TutorBubble({
	message,
	now,
	onRetry,
}: {
	message: TutorMessage;
	now: number;
	onRetry: () => void;
}) {
	const stalled = isStalled(message, now);
	if (message.status === "error" || stalled) {
		return (
			<div className="rounded-3xl bg-red-50 p-5 text-lg text-red-700">
				{stalled ? "The tutor didn't answer." : "Something went wrong."}{" "}
				<button
					type="button"
					onClick={onRetry}
					className="inline-flex items-center gap-1 font-bold underline"
				>
					<RotateCcw className="h-4 w-4" /> Try again
				</button>
				{message.error && (
					<p className="mt-1 text-sm text-red-500">{message.error}</p>
				)}
			</div>
		);
	}
	if (!message.text) {
		return (
			<div className="flex gap-2 rounded-3xl bg-white p-6 shadow-sm">
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className="h-3 w-3 animate-bounce rounded-full bg-indigo-300"
						style={{ animationDelay: `${i * 0.15}s` }}
					/>
				))}
			</div>
		);
	}
	return (
		<div className="whitespace-pre-wrap rounded-3xl bg-white p-6 text-2xl leading-relaxed text-slate-800 shadow-sm">
			{message.text}
		</div>
	);
}

function LessonView() {
	const { conversationId } = Route.useParams();
	const authorName = useAuthorName();
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showDetails, setShowDetails] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);

	const { data: conversation } = useQuery({
		queryKey: ["conversation", conversationId],
		queryFn: () => getConversation(conversationId),
	});
	const itemId = conversation?.agendaItemId;
	const { data: item } = useQuery({
		queryKey: ["agendaItem", itemId],
		queryFn: async () =>
			itemId
				? unwrap(await client.models.AgendaItem.get({ id: itemId }))
				: null,
		enabled: !!itemId,
	});
	const { data: children = [] } = useQuery({
		queryKey: ["children"],
		queryFn: listChildren,
	});
	const child = children.find((c) => c.id === conversation?.childId);
	const colors = colorClasses(child?.color);

	const {
		messages,
		now,
		busy,
		error: liveError,
	} = useConversationMessages(conversationId);
	const readAloud = useReadAloud();

	async function send(text: string) {
		const trimmed = text.trim();
		if (!trimmed || busy || sending) return;
		setSending(true);
		setError(null);
		setInput("");
		try {
			await postMessage(conversationId, trimmed, authorName);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSending(false);
		}
	}

	const speech = useSpeechInput((heard) => send(heard));

	// Read each finished reply aloud once.
	const spoken = useRef(new Set<string>());
	const loadedAt = useRef(Date.now());
	useEffect(() => {
		for (const m of messages) {
			if (
				m.role !== "assistant" ||
				m.status !== "done" ||
				spoken.current.has(m.id)
			) {
				continue;
			}
			spoken.current.add(m.id);
			// Don't read out the old history when reopening a lesson.
			const fresh = new Date(m.updatedAt).getTime() > loadedAt.current - 5000;
			if (fresh && readAloud.enabled && m.text) readAloud.speak(m.text);
		}
	}, [messages, readAloud]);

	const last = messages.at(-1);
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the latest message grows
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages.length, last?.text]);

	const kidMode = typeof window !== "undefined" ? getKidMode() : null;
	const finished = messages.some((m) => m.role === "user" && m.text === DONE);
	const started = messages.length > 0;

	return (
		<div className={`flex h-full flex-col ${colors.bg}`}>
			<header className="flex items-center gap-3 px-5 py-4">
				{kidMode ? (
					<Link
						to="/kid/$childId"
						params={{ childId: kidMode.childId }}
						className="rounded-full bg-white/80 p-3 text-slate-500 shadow-sm"
						aria-label="Back to my day"
					>
						<ArrowLeft className="h-6 w-6" />
					</Link>
				) : (
					<Link
						to="/"
						search={{ date: item?.date }}
						className="rounded-full bg-white/80 p-3 text-slate-500 shadow-sm"
						aria-label="Back to the agenda"
					>
						<ArrowLeft className="h-6 w-6" />
					</Link>
				)}
				<span className="text-4xl">{item?.emoji ?? "⭐"}</span>
				<div className="min-w-0 flex-1">
					<p className="truncate text-2xl font-bold text-slate-800">
						{item?.title ?? conversation?.title ?? "Lesson"}
					</p>
					{child && (
						<p className={`text-sm font-semibold ${colors.text}`}>
							with {child.name}
						</p>
					)}
				</div>
				{readAloud.supported && (
					<button
						type="button"
						onClick={() => readAloud.setEnabled(!readAloud.enabled)}
						aria-pressed={readAloud.enabled}
						aria-label={readAloud.enabled ? "Stop reading aloud" : "Read aloud"}
						title={readAloud.enabled ? "Reading aloud" : "Read aloud is off"}
						className="rounded-full bg-white/80 p-3 text-slate-600 shadow-sm"
					>
						{readAloud.enabled ? (
							<Volume2 className="h-6 w-6" />
						) : (
							<VolumeX className="h-6 w-6" />
						)}
					</button>
				)}
			</header>

			{item && !kidMode && (
				<div className="mx-5 mb-2 rounded-2xl bg-white/70 px-4 py-2 text-sm text-slate-600">
					<button
						type="button"
						onClick={() => setShowDetails((s) => !s)}
						className="flex w-full items-center justify-between font-semibold"
					>
						For grown-ups
						<ChevronDown
							className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
						/>
					</button>
					{showDetails && (
						<div className="mt-2 space-y-2 pb-1">
							{item.description && <p>{item.description}</p>}
							{(item.resources ?? [])
								.filter((r) => !!r)
								.map((r) => (
									<p key={r?.id}>
										<span className="font-semibold">{r?.label}</span>
										{r?.type === "worksheet" && r.s3Key ? (
											<>
												{" "}
												·{" "}
												<Link
													to="/worksheet"
													search={{ key: r.s3Key }}
													target="_blank"
													className="text-indigo-600 underline"
												>
													Open worksheet
												</Link>
											</>
										) : r?.description ? (
											` - ${r.description}`
										) : null}
									</p>
								))}
						</div>
					)}
				</div>
			)}

			<main className="flex-1 overflow-y-auto px-5 py-4">
				<div className="mx-auto max-w-3xl space-y-4">
					{messages.map((m) =>
						m.role === "user" ? (
							<div key={m.id} className="flex justify-end">
								<div className="max-w-[80%] rounded-3xl bg-indigo-500 px-5 py-3 text-xl text-white">
									{m.text}
								</div>
							</div>
						) : (
							<TutorBubble
								key={m.id}
								message={m}
								now={now}
								onRetry={() => requestReply(m.conversationId, m.sentAt)}
							/>
						),
					)}
					{(error || liveError) && (
						<p className="text-red-600">{error ?? liveError}</p>
					)}
					<div ref={bottomRef} />
				</div>
			</main>

			<footer className="px-5 pb-6 pt-2">
				<div className="mx-auto max-w-3xl">
					{!started ? (
						<button
							type="button"
							onClick={() => send(START)}
							disabled={sending || !conversation}
							className="w-full rounded-full bg-indigo-600 py-5 text-2xl font-bold text-white shadow-lg transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
						>
							{START}
						</button>
					) : (
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								{speech.supported && (
									<button
										type="button"
										onClick={speech.listening ? speech.stop : speech.start}
										disabled={busy || sending}
										aria-label={speech.listening ? "Stop listening" : "Talk"}
										className={`flex-shrink-0 rounded-full p-5 text-white shadow-lg transition active:scale-95 disabled:opacity-50 ${
											speech.listening
												? "animate-pulse bg-red-500"
												: "bg-amber-500 hover:bg-amber-600"
										}`}
									>
										<Mic className="h-8 w-8" />
									</button>
								)}
								<form
									className="relative flex-1"
									onSubmit={(e) => {
										e.preventDefault();
										send(input);
									}}
								>
									<input
										value={input}
										onChange={(e) => setInput(e.target.value)}
										placeholder={
											speech.supported ? "Talk or type…" : "Type an answer…"
										}
										aria-label="Your answer"
										className="w-full rounded-full border-2 border-white bg-white py-4 pl-6 pr-14 text-xl shadow-sm focus:border-indigo-300 focus:outline-none"
									/>
									<button
										type="submit"
										disabled={!input.trim() || busy || sending}
										aria-label="Send"
										className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-indigo-600 disabled:opacity-40"
									>
										<Send className="h-6 w-6" />
									</button>
								</form>
							</div>
							{speech.error && (
								<p className="text-center text-slate-600">{speech.error}</p>
							)}
							<div className="flex justify-center">
								{finished ? (
									kidMode ? (
										<Link
											to="/kid/$childId"
											params={{ childId: kidMode.childId }}
											className="rounded-full bg-emerald-500 px-8 py-3 text-xl font-bold text-white shadow-md"
										>
											Back to my day
										</Link>
									) : (
										<Link
											to="/"
											search={{ date: item?.date }}
											className="rounded-full bg-emerald-500 px-8 py-3 text-xl font-bold text-white shadow-md"
										>
											Back to the agenda
										</Link>
									)
								) : (
									<button
										type="button"
										onClick={() => send(DONE)}
										disabled={busy || sending}
										className="rounded-full bg-emerald-500 px-8 py-3 text-xl font-bold text-white shadow-md transition hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
									>
										We're done! 🎉
									</button>
								)}
							</div>
						</div>
					)}
				</div>
			</footer>
		</div>
	);
}
