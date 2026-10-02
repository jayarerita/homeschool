import { Link } from "@tanstack/react-router";
import { Bot, Check, GraduationCap, Plus, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import {
	isStalled,
	type TutorChat,
	type TutorMessage,
} from "~/hooks/useTutorChat";
import type { Child } from "~/lib/agenda";

type Props = {
	chat: TutorChat;
	household: Child[];
	variant?: "footer" | "sidebar";
};

function Thinking() {
	return (
		<span className="inline-flex items-center gap-1 text-slate-400">
			<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
			<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
			<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
			<span className="ml-1 text-xs">Thinking…</span>
		</span>
	);
}

function MessageBubble({
	message,
	now,
	onRetry,
}: {
	message: TutorMessage;
	now: number;
	onRetry: () => void;
}) {
	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-none bg-indigo-500 px-3 py-2 text-sm leading-relaxed text-white shadow-sm">
					{message.text}
				</div>
			</div>
		);
	}

	// Activity lines only ever grow, so position plus text is a stable key.
	const activity = (message.activity ?? [])
		.filter((text): text is string => !!text)
		.map((text, n) => ({ text, key: `${n}:${text}` }));
	const stalled = isStalled(message, now);
	const failed = message.status === "error" || stalled;
	const waiting =
		!stalled &&
		(message.status === "pending" ||
			(message.status === "streaming" && !message.text));
	return (
		<div className="flex justify-start">
			<div className="max-w-[92%] rounded-2xl rounded-bl-none border border-slate-100 bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-700 shadow-sm">
				{message.text && (
					<div className="tutor-markdown">
						<Markdown>{message.text}</Markdown>
					</div>
				)}
				{waiting && <Thinking />}
				{activity.length > 0 && (
					<ul className="mt-2 space-y-1 border-t border-slate-200 pt-2">
						{activity.map((line) => (
							<li
								key={line.key}
								className="flex items-start gap-1.5 text-xs text-emerald-700"
							>
								<Check className="mt-0.5 h-3 w-3 flex-shrink-0" />
								{line.text}
							</li>
						))}
					</ul>
				)}
				{failed && (
					<div className="mt-1 text-xs text-red-600">
						{stalled
							? "The tutor didn't respond."
							: (message.error ?? "Something went wrong.")}{" "}
						<button
							type="button"
							onClick={onRetry}
							className="inline-flex items-center gap-1 font-semibold underline"
						>
							<RotateCcw className="h-3 w-3" />
							Try again
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

function ConversationBar({ chat }: { chat: TutorChat }) {
	return (
		<div className="flex items-center gap-2">
			<select
				value={chat.conversation?.id ?? ""}
				onChange={(e) => chat.select(e.target.value || null)}
				aria-label="Conversation"
				className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
			>
				<option value="">New conversation</option>
				{chat.conversations.map((c) => (
					<option key={c.id} value={c.id}>
						{c.mode === "lesson" ? "Lesson: " : ""}
						{c.title || "Untitled"}
					</option>
				))}
			</select>
			<button
				type="button"
				onClick={chat.startNew}
				aria-label="New conversation"
				title="New conversation"
				className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
			>
				<Plus className="h-4 w-4" />
			</button>
		</div>
	);
}

function LessonBanner({
	chat,
	household,
}: {
	chat: TutorChat;
	household: Child[];
}) {
	const conversation = chat.conversation;
	if (conversation?.mode !== "lesson") return null;
	const child = household.find((c) => c.id === conversation.childId);
	return (
		<div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
			<GraduationCap className="h-4 w-4 flex-shrink-0 text-amber-600" />
			<span>
				Lesson: <span className="font-semibold">{conversation.title}</span>
				{child && ` with ${child.name}`}. The tutor talks to{" "}
				{child?.name ?? "your child"} directly.{" "}
				<Link
					to="/lesson/$conversationId"
					params={{ conversationId: conversation.id }}
					className="font-semibold underline"
				>
					Open lesson view
				</Link>
			</span>
		</div>
	);
}

function InputRow({ chat }: { chat: TutorChat }) {
	const [input, setInput] = useState("");
	const lesson = chat.conversation?.mode === "lesson";

	function submit() {
		const text = input.trim();
		if (!text || chat.busy) return;
		setInput("");
		chat.send(text);
	}

	return (
		<div className="relative">
			<textarea
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
				}}
				rows={1}
				placeholder={
					lesson
						? "Type what your child says…"
						: "Ask the tutor to plan, adjust or explain…"
				}
				className="max-h-32 w-full resize-none rounded-2xl border border-slate-200 py-3 pl-4 pr-10 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
			/>
			<button
				type="button"
				onClick={submit}
				disabled={chat.busy || !input.trim()}
				aria-label="Send message"
				className="absolute bottom-3.5 right-3 text-indigo-500 transition hover:text-indigo-700 disabled:opacity-40"
			>
				<Send className="h-4 w-4" />
			</button>
		</div>
	);
}

function MessageList({ chat }: { chat: TutorChat }) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const last = chat.messages.at(-1);
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the latest message grows
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [chat.messages.length, last?.text, last?.status]);

	return (
		<div className="space-y-3">
			{chat.messages.map((m) => (
				<MessageBubble
					key={m.id}
					message={m}
					now={chat.now}
					onRetry={() => chat.retry(m)}
				/>
			))}
			{chat.error && <p className="text-xs text-red-600">{chat.error}</p>}
			<div ref={bottomRef} />
		</div>
	);
}

export default function ChatPanel({
	chat,
	household,
	variant = "footer",
}: Props) {
	if (variant === "sidebar") {
		return (
			<div className="flex h-full flex-col bg-white">
				<div className="space-y-3 border-b border-slate-200 px-5 py-4">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100">
							<Bot className="h-4 w-4 text-indigo-500" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-800">Tutor</p>
							<p className="text-[11px] text-slate-400">
								Plans, prepares, and remembers what works
							</p>
						</div>
					</div>
					<ConversationBar chat={chat} />
					<LessonBanner chat={chat} household={household} />
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-4">
					{chat.messages.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-3 pb-8 text-center">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
								<Bot className="h-6 w-6 text-slate-400" />
							</div>
							<div>
								<p className="text-sm font-medium text-slate-600">
									How can I help?
								</p>
								<p className="mt-1 text-xs text-slate-400">
									Try “Plan tomorrow morning around this week's preschool theme”
									or “What materials do I need for Thursday?”
								</p>
							</div>
							{chat.error && (
								<p className="text-xs text-red-600">{chat.error}</p>
							)}
						</div>
					) : (
						<MessageList chat={chat} />
					)}
				</div>

				<div className="border-t border-slate-200 px-5 py-4">
					<InputRow chat={chat} />
				</div>
			</div>
		);
	}

	// Footer variant (mobile drawer)
	return (
		<div className="space-y-3 px-4 pb-6 pt-3">
			<ConversationBar chat={chat} />
			<LessonBanner chat={chat} household={household} />
			{(chat.messages.length > 0 || chat.error) && (
				<div className="max-h-[50dvh] overflow-y-auto">
					<MessageList chat={chat} />
				</div>
			)}
			<InputRow chat={chat} />
		</div>
	);
}
