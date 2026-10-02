import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useRef } from "react";
import { fileUrl } from "~/lib/files";

const WORKSHEET_PREFIX = "uploads/worksheets/";

export const Route = createFileRoute("/_authed/worksheet")({
	validateSearch: (search: Record<string, unknown>): { key?: string } => ({
		key:
			typeof search.key === "string" &&
			search.key.startsWith(WORKSHEET_PREFIX) &&
			!search.key.includes("..")
				? search.key
				: undefined,
	}),
	component: WorksheetView,
});

// Shows a tutor-made worksheet for printing. The HTML is model-generated, so
// it's rendered in a sandboxed iframe: no scripts (no allow-scripts), and the
// file itself carries a CSP that blocks external loads. allow-same-origin
// (safe without allow-scripts) lets this page call print() on the frame;
// allow-modals lets the print dialog open.
function WorksheetView() {
	const { key } = Route.useSearch();
	const frame = useRef<HTMLIFrameElement>(null);
	const {
		data: html,
		error,
		isLoading,
	} = useQuery({
		queryKey: ["worksheet", key],
		queryFn: async () => {
			if (!key) throw new Error("No worksheet selected.");
			const res = await fetch(await fileUrl(key));
			if (!res.ok) throw new Error("Couldn't load the worksheet.");
			return res.text();
		},
		enabled: !!key,
	});

	return (
		<div className="flex h-full flex-col bg-slate-100">
			<div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
				<p className="text-sm font-semibold text-slate-600">Worksheet</p>
				<button
					type="button"
					disabled={!html}
					onClick={() => frame.current?.contentWindow?.print()}
					className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
				>
					<Printer className="h-4 w-4" />
					Print
				</button>
			</div>
			<div className="flex-1 overflow-auto p-4">
				{!key && <p className="text-slate-500">No worksheet selected.</p>}
				{isLoading && <p className="text-slate-400">Loading…</p>}
				{error && <p className="text-red-600">{(error as Error).message}</p>}
				{html && (
					<iframe
						ref={frame}
						title="Worksheet"
						sandbox="allow-same-origin allow-modals"
						srcDoc={html}
						className="mx-auto block h-[11in] w-[8.5in] max-w-full bg-white shadow-md"
					/>
				)}
			</div>
		</div>
	);
}
