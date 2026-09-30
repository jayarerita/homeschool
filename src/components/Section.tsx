export default function Section({
	title,
	description,
	action,
	children,
}: {
	title: string;
	description?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h2 className="text-lg font-bold text-slate-800">{title}</h2>
					{description && (
						<p className="mt-0.5 text-sm text-slate-500">{description}</p>
					)}
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}

export const inputClass =
	"w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export const labelClass =
	"mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500";

export const primaryButtonClass =
	"rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50";

export const secondaryButtonClass =
	"rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 disabled:opacity-50";

export function ErrorText({ error }: { error: unknown }) {
	if (!error) return null;
	return (
		<p className="mt-2 text-sm text-red-600">
			{error instanceof Error ? error.message : String(error)}
		</p>
	);
}
