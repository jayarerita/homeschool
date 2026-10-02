import { useState } from "react";
import Modal from "~/components/Modal";
import { primaryButtonClass, secondaryButtonClass } from "~/components/Section";
import { parentCheck } from "~/lib/kid-mode";

// A quick check that a grown-up is leaving kid mode.
export default function ParentGate({
	onUnlock,
	onCancel,
}: {
	onUnlock: () => void;
	onCancel: () => void;
}) {
	const [check, setCheck] = useState(() => parentCheck());
	const [answer, setAnswer] = useState("");
	const [wrong, setWrong] = useState(false);

	return (
		<Modal title="Grown-ups only" onClose={onCancel}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (Number(answer) === check.answer) {
						onUnlock();
					} else {
						setWrong(true);
						setAnswer("");
						setCheck(parentCheck());
					}
				}}
				className="space-y-4"
			>
				<label className="block">
					<span className="text-sm text-slate-600">
						To leave kid mode, what is{" "}
						<span className="font-bold text-slate-800">{check.question}</span>?
					</span>
					<input
						inputMode="numeric"
						autoComplete="off"
						value={answer}
						onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))}
						className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-lg"
						aria-label="Answer"
					/>
				</label>
				{wrong && (
					<p className="text-sm text-red-600">Not quite. Here's a new one.</p>
				)}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className={secondaryButtonClass}
					>
						Stay in kid mode
					</button>
					<button
						type="submit"
						disabled={!answer}
						className={primaryButtonClass}
					>
						Unlock
					</button>
				</div>
			</form>
		</Modal>
	);
}
