import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Section, { ErrorText, primaryButtonClass } from "~/components/Section";
import { type LegacyDay, parseLegacyDay } from "~/lib/legacy-import";
import {
	type ImportResult,
	importLegacyDays,
} from "~/lib/legacy-import-runner";

type Parsed = { days: LegacyDay[]; problems: string[] };

async function parseFiles(files: FileList): Promise<Parsed> {
	const days: LegacyDay[] = [];
	const problems: string[] = [];
	for (const file of Array.from(files)) {
		try {
			days.push(parseLegacyDay(JSON.parse(await file.text()), file.name));
		} catch (e) {
			problems.push(`${file.name}: ${(e as Error).message}`);
		}
	}
	return { days, problems };
}

export default function ImportSettings() {
	const queryClient = useQueryClient();
	const [parsed, setParsed] = useState<Parsed | null>(null);
	const [progress, setProgress] = useState<[number, number] | null>(null);
	const [result, setResult] = useState<ImportResult | null>(null);
	const [error, setError] = useState<unknown>(null);
	const running = progress !== null && result === null && !error;

	async function run(days: LegacyDay[]) {
		setError(null);
		setResult(null);
		setProgress([0, days.length]);
		try {
			setResult(
				await importLegacyDays(days, (done, total) =>
					setProgress([done, total]),
				),
			);
		} catch (e) {
			setError(e);
		} finally {
			queryClient.invalidateQueries({ queryKey: ["children"] });
			queryClient.invalidateQueries({ queryKey: ["agenda"] });
		}
	}

	return (
		<Section
			title="Import from the local app"
			description="Upload day files (YYYY-MM-DD.json) from the pre-cloud version. Children are matched by name; days that already exist are skipped."
		>
			<input
				type="file"
				accept="application/json,.json"
				multiple
				disabled={running}
				onChange={async (e) => {
					setResult(null);
					setError(null);
					setProgress(null);
					setParsed(e.target.files ? await parseFiles(e.target.files) : null);
				}}
				className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-600 hover:file:bg-indigo-100"
			/>

			{parsed && (
				<div className="mt-4 space-y-2 text-sm">
					<p className="text-slate-600">
						{parsed.days.length} day{parsed.days.length === 1 ? "" : "s"} ready
						to import
						{parsed.days.length > 0 &&
							` (${parsed.days.reduce((n, d) => n + d.items.length, 0)} agenda items)`}
						.
					</p>
					{parsed.problems.length > 0 && (
						<ul className="list-inside list-disc text-amber-700">
							{parsed.problems.map((p) => (
								<li key={p}>{p}</li>
							))}
						</ul>
					)}
					<button
						type="button"
						disabled={running || parsed.days.length === 0}
						onClick={() => run(parsed.days)}
						className={primaryButtonClass}
					>
						{running && progress
							? `Importing ${progress[0]}/${progress[1]}…`
							: "Import"}
					</button>
				</div>
			)}

			<ErrorText error={error} />
			{result && (
				<div className="mt-3 text-sm text-emerald-700">
					<p>
						Imported {result.imported.length} day
						{result.imported.length === 1 ? "" : "s"}
						{result.skipped.length > 0 &&
							`, skipped ${result.skipped.length} that already existed`}
						.
					</p>
					{result.childrenCreated.length > 0 && (
						<p>
							Added children: {result.childrenCreated.join(", ")}. You can set
							their colors and details above.
						</p>
					)}
				</div>
			)}
		</Section>
	);
}
