import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = overflow;
		};
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
			>
				<div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
					<h2 className="text-lg font-bold text-slate-800">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				<div className="overflow-y-auto px-5 py-4">{children}</div>
			</div>
		</div>
	);
}
