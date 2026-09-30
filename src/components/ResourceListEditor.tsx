import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Plus, X } from "lucide-react";
import { useState } from "react";
import { ErrorText, inputClass, labelClass } from "~/components/Section";
import type { Resource } from "~/lib/agenda";
import { client, unwrap } from "~/lib/data-client";
import { uploadFile } from "~/lib/files";
import { compact } from "~/lib/planning";
import {
	type LibraryResource,
	listLibrary,
	RESOURCE_KINDS,
	type ResourceKind,
} from "~/lib/planning-data";

export type ResourceDraft = Omit<Resource, "type"> & { type: ResourceKind };

export function toResourceDrafts(
	resources: readonly (Resource | null | undefined)[] | null | undefined,
): ResourceDraft[] {
	return compact(resources).map((r) => ({ ...r, type: r.type ?? "note" }));
}

function fromLibrary(resource: LibraryResource): ResourceDraft {
	return {
		id: crypto.randomUUID(),
		label: resource.label,
		type: resource.type,
		url: resource.url,
		s3Key: resource.s3Key,
		description: resource.description,
		prompts: resource.prompts,
		libraryResourceId: resource.id,
	};
}

function NewResourceForm({
	onAdd,
	onCancel,
}: {
	onAdd: (resource: ResourceDraft) => void;
	onCancel: () => void;
}) {
	const queryClient = useQueryClient();
	const [label, setLabel] = useState("");
	const [type, setType] = useState<ResourceKind>("link");
	const [url, setUrl] = useState("");
	const [description, setDescription] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [saveToLibrary, setSaveToLibrary] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);

	async function add() {
		if (!label.trim()) return;
		setBusy(true);
		setError(null);
		try {
			const uploaded = file ? await uploadFile(file) : null;
			const fields = {
				label: label.trim(),
				type,
				url: url.trim() || null,
				s3Key: uploaded?.s3Key ?? null,
				description: description.trim() || null,
			};
			let libraryResourceId: string | null = null;
			if (saveToLibrary) {
				const saved = unwrap(
					await client.models.LibraryResource.create(fields),
				);
				libraryResourceId = saved?.id ?? null;
				queryClient.invalidateQueries({ queryKey: ["library"] });
			}
			onAdd({ id: crypto.randomUUID(), ...fields, libraryResourceId });
		} catch (e) {
			setError(e);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-3 rounded-2xl border border-slate-200 p-3">
			<div className="grid grid-cols-[1fr_9rem] gap-2">
				<input
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="Name"
					aria-label="Resource name"
					className={inputClass}
				/>
				<select
					value={type}
					onChange={(e) => setType(e.target.value as ResourceKind)}
					aria-label="Resource type"
					className={inputClass}
				>
					{RESOURCE_KINDS.map((k) => (
						<option key={k.value} value={k.value}>
							{k.label}
						</option>
					))}
				</select>
			</div>
			<input
				type="url"
				value={url}
				onChange={(e) => setUrl(e.target.value)}
				placeholder="https://… (optional)"
				aria-label="Link"
				className={inputClass}
			/>
			<textarea
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				placeholder="Description or instructions (optional)"
				aria-label="Description"
				rows={2}
				className={inputClass}
			/>
			<label className="flex items-center gap-2 text-sm text-slate-600">
				<Paperclip className="h-4 w-4 text-slate-400" />
				<input
					type="file"
					onChange={(e) => setFile(e.target.files?.[0] ?? null)}
					className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
				/>
			</label>
			<label className="flex items-center gap-2 text-sm text-slate-600">
				<input
					type="checkbox"
					checked={saveToLibrary}
					onChange={(e) => setSaveToLibrary(e.target.checked)}
				/>
				Also save to the resource library
			</label>
			<ErrorText error={error} />
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={add}
					disabled={busy || !label.trim()}
					className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
				>
					{busy ? "Adding…" : "Add resource"}
				</button>
			</div>
		</div>
	);
}

export default function ResourceListEditor({
	value,
	onChange,
}: {
	value: ResourceDraft[];
	onChange: (resources: ResourceDraft[]) => void;
}) {
	const [adding, setAdding] = useState(false);
	const { data: library = [] } = useQuery({
		queryKey: ["library"],
		queryFn: listLibrary,
	});
	const available = library.filter(
		(l) => !value.some((r) => r.libraryResourceId === l.id),
	);

	return (
		<div>
			<span className={labelClass}>Resources</span>
			{value.length > 0 && (
				<ul className="mb-2 space-y-1.5">
					{value.map((r) => (
						<li
							key={r.id}
							className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
						>
							<span className="flex-1 truncate text-slate-700">{r.label}</span>
							<span className="text-xs text-slate-400">
								{RESOURCE_KINDS.find((k) => k.value === r.type)?.label}
								{r.s3Key && " · file"}
							</span>
							<button
								type="button"
								onClick={() => onChange(value.filter((x) => x.id !== r.id))}
								aria-label={`Remove ${r.label}`}
								className="rounded p-0.5 text-slate-400 hover:text-red-600"
							>
								<X className="h-4 w-4" />
							</button>
						</li>
					))}
				</ul>
			)}

			{adding ? (
				<NewResourceForm
					onAdd={(r) => {
						onChange([...value, r]);
						setAdding(false);
					}}
					onCancel={() => setAdding(false)}
				/>
			) : (
				<div className="flex flex-wrap gap-2">
					{available.length > 0 && (
						<select
							value=""
							onChange={(e) => {
								const picked = library.find((l) => l.id === e.target.value);
								if (picked) onChange([...value, fromLibrary(picked)]);
							}}
							aria-label="Add from library"
							className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-600"
						>
							<option value="">Add from library…</option>
							{available.map((l) => (
								<option key={l.id} value={l.id}>
									{l.label}
								</option>
							))}
						</select>
					)}
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
					>
						<Plus className="h-4 w-4" />
						New resource
					</button>
				</div>
			)}
		</div>
	);
}
