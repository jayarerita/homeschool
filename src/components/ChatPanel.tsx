import { Bot, Mic, Send } from "lucide-react";

type Props = {
	variant?: "footer" | "sidebar";
};

// UI shell ported from the NanoClaw app. Messaging is wired to the cloud tutor
// in phase 4 (Conversation/Message models + tutorTurn Lambda); until then the
// input is disabled.
function InputRow() {
	return (
		<div className="flex items-center gap-2">
			<div className="relative flex-1">
				<input
					disabled
					placeholder="Tutor coming soon…"
					className="w-full rounded-full border border-slate-200 py-3 pl-4 pr-10 text-sm placeholder:text-slate-400 disabled:bg-slate-50"
				/>
				<button
					type="button"
					disabled
					aria-label="Send message"
					className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 disabled:opacity-40"
				>
					<Send className="h-4 w-4" />
				</button>
			</div>
			<button
				type="button"
				disabled
				aria-label="Voice input"
				className="flex-shrink-0 rounded-full bg-yellow-100 p-3 text-yellow-700 shadow-sm disabled:opacity-40"
			>
				<Mic className="h-4 w-4" />
			</button>
		</div>
	);
}

export default function ChatPanel({ variant = "footer" }: Props) {
	if (variant === "sidebar") {
		return (
			<div className="flex h-full flex-col bg-white">
				<div className="border-b border-slate-200 px-5 py-4">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100">
							<Bot className="h-4 w-4 text-indigo-500" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-800">Tutor</p>
							<div className="flex items-center gap-1.5">
								<span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
								<span className="text-[11px] text-slate-400">
									Not connected yet
								</span>
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-4 pb-8 text-center">
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
						<Bot className="h-6 w-6 text-slate-400" />
					</div>
					<div>
						<p className="text-sm font-medium text-slate-600">Coming soon</p>
						<p className="mt-1 text-xs text-slate-400">
							Your tutor will adjust the schedule, add activities, and answer
							questions here.
						</p>
					</div>
				</div>

				<div className="border-t border-slate-200 px-5 py-4">
					<InputRow />
				</div>
			</div>
		);
	}

	return (
		<div className="px-4 pb-6 pt-3">
			<InputRow />
		</div>
	);
}
