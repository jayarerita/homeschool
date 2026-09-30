import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Paperclip, Pencil } from "lucide-react";
import { useState } from "react";
import Modal from "~/components/Modal";
import Section, {
	ErrorText,
	inputClass,
	labelClass,
	primaryButtonClass,
	secondaryButtonClass,
} from "~/components/Section";
import { client, unwrap } from "~/lib/data-client";
import { fileNameFromKey, openFile, uploadFile } from "~/lib/files";
import { compact, splitList } from "~/lib/planning";
import {
	type LibraryResource,
	listLibrary,
	RESOURCE_KINDS,
	type ResourceKind,
} from "~/lib/planning-data";

export const Route = createFileRoute("/_authed/planning/library")({
	component: LibraryPage,
});

function kindLabel(kind: ResourceKind): string {
	return RESOURCE_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function ageLabel(min?: number | null, max?: number | null): string | null {
	if (min != null && max != null) return `ages ${min}–${max}`;
	if (min != null) return `ages ${min}+`;
	if (max != null) return `up to age ${max}`;
	return null;
}

function toInt(text: string): number | null {
	const n = Number.parseInt(text, 10);
	return Number.isNaN(n) ? null : n;
}

function ResourceEditor({
	resource,
	onDone,
}: {
	resource: LibraryResource | null;
	onDone: () => void;
}) {
	const queryClient = useQueryClient();
	const [label, setLabel] = useState(resource?.label ?? "");
	const [type, setType] = useState<ResourceKind>(resource?.type ?? "link");
	const [url, setUrl] = useState(resource?.url ?? "");
	const [s3Key, setS3Key] = useState(resource?.s3Key ?? null);
	const [description, setDescription] = useState(resource?.description ?? "");
	const [tags, setTags] = useState(compact(resource?.tags).join(", "));
	const [minAge, setMinAge] = useState(resource?.minAge?.toString() ?? "");
	const [maxAge, setMaxAge] = useState(resource?.maxAge?.toString() ?? "");
	const [prompts, setPrompts] = useState(compact(resource?.prompts).join("\n"));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);

	async function run(action: () => Promise<void>) {
		setBusy(true);
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(e);
			setBusy(false);
		}
	}

	const done = async () => {
		await queryClient.invalidateQueries({ queryKey: ["library"] });
		onDone();
	};

	async function save() {
		const fields = {
			label: label.trim(),
			type,
			url: url.trim() || null,
			s3Key,
			description: description.trim() || null,
			tags: splitList(tags),
			minAge: toInt(minAge),
			maxAge: toInt(maxAge),
			prompts: splitList(prompts, "\n"),
		};
		unwrap(
			resource
				? await client.models.LibraryResource.update({
						id: resource.id,
						...fields,
					})
				: await client.models.LibraryResource.create(fields),
		);
		await done();
	}

	// Files are left in storage: agenda items and routines keep their own copy
	// of the resource entry, which may still point at the file.
	async function remove() {
		if (
			!resource ||
			!window.confirm(`Delete "${resource.label}" from the library?`)
		) {
			return;
		}
		unwrap(await client.models.LibraryResource.delete({ id: resource.id }));
		await done();
	}

	return (
		<Modal title={resource ? "Edit resource" : "Add resource"} onClose={onDone}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (label.trim()) run(save);
				}}
				className="space-y-4"
			>
				<div className="grid grid-cols-[1fr_10rem] gap-3">
					<label>
						<span className={labelClass}>Name</span>
						<input
							required
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							className={inputClass}
						/>
					</label>
					<label>
						<span className={labelClass}>Type</span>
						<select
							value={type}
							onChange={(e) => setType(e.target.value as ResourceKind)}
							className={inputClass}
						>
							{RESOURCE_KINDS.map((k) => (
								<option key={k.value} value={k.value}>
									{k.label}
								</option>
							))}
						</select>
					</label>
				</div>
				<label className="block">
					<span className={labelClass}>Link</span>
					<input
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://…"
						className={inputClass}
					/>
				</label>
				<div>
					<span className={labelClass}>File</span>
					{s3Key ? (
						<div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
							<button
								type="button"
								onClick={() => openFile(s3Key)}
								className="flex-1 truncate text-left text-indigo-600 hover:underline"
							>
								{fileNameFromKey(s3Key)}
							</button>
							<button
								type="button"
								onClick={() => setS3Key(null)}
								className="text-xs font-semibold text-slate-400 hover:text-red-600"
							>
								Remove
							</button>
						</div>
					) : (
						<label className="flex items-center gap-2 text-sm text-slate-600">
							<Paperclip className="h-4 w-4 text-slate-400" />
							<input
								type="file"
								disabled={busy}
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) {
										run(async () => {
											setS3Key((await uploadFile(file)).s3Key);
											setBusy(false);
										});
									}
								}}
								className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
							/>
						</label>
					)}
				</div>
				<label className="block">
					<span className={labelClass}>Description</span>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={3}
						className={inputClass}
					/>
				</label>
				<div className="grid grid-cols-[1fr_5rem_5rem] gap-3">
					<label>
						<span className={labelClass}>Tags</span>
						<input
							value={tags}
							onChange={(e) => setTags(e.target.value)}
							placeholder="phonics, songs"
							className={inputClass}
						/>
					</label>
					<label>
						<span className={labelClass}>Min age</span>
						<input
							type="number"
							min={0}
							value={minAge}
							onChange={(e) => setMinAge(e.target.value)}
							className={inputClass}
						/>
					</label>
					<label>
						<span className={labelClass}>Max age</span>
						<input
							type="number"
							min={0}
							value={maxAge}
							onChange={(e) => setMaxAge(e.target.value)}
							className={inputClass}
						/>
					</label>
				</div>
				<label className="block">
					<span className={labelClass}>AI prompts (one per line)</span>
					<textarea
						value={prompts}
						onChange={(e) => setPrompts(e.target.value)}
						rows={3}
						placeholder="Prompts for generating a worksheet or activity from this resource"
						className={inputClass}
					/>
				</label>
				<ErrorText error={error} />
				<div className="flex items-center gap-2 border-t border-slate-100 pt-4">
					{resource && (
						<button
							type="button"
							disabled={busy}
							onClick={() => run(remove)}
							className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
						>
							Delete
						</button>
					)}
					<div className="flex-1" />
					<button
						type="button"
						onClick={onDone}
						className={secondaryButtonClass}
					>
						Cancel
					</button>
					<button type="submit" disabled={busy} className={primaryButtonClass}>
						{busy ? "Saving…" : resource ? "Save" : "Add"}
					</button>
				</div>
			</form>
		</Modal>
	);
}

function LibraryPage() {
	const [editing, setEditing] = useState<LibraryResource | "new" | null>(null);
	const [search, setSearch] = useState("");
	const [kind, setKind] = useState<ResourceKind | "">("");
	const { data: resources = [], isLoading } = useQuery({
		queryKey: ["library"],
		queryFn: listLibrary,
	});

	const needle = search.trim().toLowerCase();
	const visible = resources.filter(
		(r) =>
			(!kind || r.type === kind) &&
			(!needle ||
				[r.label, r.description, ...compact(r.tags)].some((text) =>
					text?.toLowerCase().includes(needle),
				)),
	);

	return (
		<Section
			title="Resource library"
			description="Books, videos, worksheets and materials you can attach to activities."
			action={
				<button
					type="button"
					onClick={() => setEditing("new")}
					className={primaryButtonClass}
				>
					Add resource
				</button>
			}
		>
			{resources.length > 0 && (
				<div className="mb-4 flex gap-2">
					<input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search names, descriptions, tags"
						aria-label="Search resources"
						className={`${inputClass} flex-1`}
					/>
					<select
						value={kind}
						onChange={(e) => setKind(e.target.value as ResourceKind | "")}
						aria-label="Filter by type"
						className={`${inputClass} w-36`}
					>
						<option value="">All types</option>
						{RESOURCE_KINDS.map((k) => (
							<option key={k.value} value={k.value}>
								{k.label}
							</option>
						))}
					</select>
				</div>
			)}
			{isLoading && <p className="text-sm text-slate-400">Loading…</p>}
			{!isLoading && resources.length === 0 && (
				<p className="text-sm text-slate-400">
					The library is empty. Resources you add to activities can be saved
					here too.
				</p>
			)}
			{resources.length > 0 && visible.length === 0 && (
				<p className="text-sm text-slate-400">No matches.</p>
			)}
			<div className="space-y-2">
				{visible.map((r) => (
					<div
						key={r.id}
						className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"
					>
						<div className="min-w-0 flex-1">
							<p className="font-semibold text-slate-700">{r.label}</p>
							<p className="truncate text-xs text-slate-500">
								{[
									kindLabel(r.type),
									ageLabel(r.minAge, r.maxAge),
									compact(r.tags).join(", "),
									r.description,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
						</div>
						{r.url && (
							<a
								href={r.url}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`Open ${r.label}`}
								className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
							>
								<ExternalLink className="h-4 w-4" />
							</a>
						)}
						{r.s3Key && (
							<button
								type="button"
								onClick={() => r.s3Key && openFile(r.s3Key)}
								aria-label={`Open file for ${r.label}`}
								className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
							>
								<Paperclip className="h-4 w-4" />
							</button>
						)}
						<button
							type="button"
							onClick={() => setEditing(r)}
							aria-label={`Edit ${r.label}`}
							className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						>
							<Pencil className="h-4 w-4" />
						</button>
					</div>
				))}
			</div>

			{editing && (
				<ResourceEditor
					resource={editing === "new" ? null : editing}
					onDone={() => setEditing(null)}
				/>
			)}
		</Section>
	);
}
