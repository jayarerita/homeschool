import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Paperclip, Pencil, X } from "lucide-react";
import { useState } from "react";
import ChildPicker from "~/components/ChildPicker";
import Modal from "~/components/Modal";
import Section, {
	ErrorText,
	inputClass,
	labelClass,
	primaryButtonClass,
	secondaryButtonClass,
} from "~/components/Section";
import { listChildren, toDateKey } from "~/lib/agenda";
import { colorClasses } from "~/lib/colors";
import { client, unwrap } from "~/lib/data-client";
import { deleteFile, openFile, uploadFile } from "~/lib/files";
import { compact, splitList } from "~/lib/planning";
import {
	type Attachment,
	type LearningUnit,
	listLearningUnits,
} from "~/lib/planning-data";

export const Route = createFileRoute("/_authed/planning/units")({
	component: UnitsPage,
});

function formatShortDate(dateKey: string): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

function addDays(dateKey: string, days: number): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	return toDateKey(new Date(y, m - 1, d + days));
}

function UnitEditor({
	unit,
	sources,
	onDone,
}: {
	unit: LearningUnit | null;
	sources: string[];
	onDone: () => void;
}) {
	const queryClient = useQueryClient();
	const today = toDateKey(new Date());
	const { data: children = [] } = useQuery({
		queryKey: ["children"],
		queryFn: listChildren,
	});

	const [title, setTitle] = useState(unit?.title ?? "");
	const [source, setSource] = useState(unit?.source ?? sources[0] ?? "");
	const [childIds, setChildIds] = useState(compact(unit?.childIds));
	const [startDate, setStartDate] = useState(unit?.startDate ?? today);
	const [endDate, setEndDate] = useState(unit?.endDate ?? addDays(today, 6));
	const [topics, setTopics] = useState(compact(unit?.topics).join(", "));
	const [notes, setNotes] = useState(unit?.notes ?? "");
	const [attachments, setAttachments] = useState<Attachment[]>(
		compact(unit?.attachments),
	);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);

	async function run(action: () => Promise<void>) {
		setBusy(true);
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(e);
		} finally {
			setBusy(false);
		}
	}

	const done = async () => {
		await queryClient.invalidateQueries({ queryKey: ["learningUnits"] });
		onDone();
	};

	async function save() {
		if (endDate < startDate)
			throw new Error("The end date is before the start.");
		const fields = {
			title: title.trim(),
			source: source.trim() || null,
			childIds: childIds.length > 0 ? childIds : null,
			startDate,
			endDate,
			topics: splitList(topics),
			notes: notes.trim() || null,
			attachments: attachments.length > 0 ? attachments : null,
		};
		unwrap(
			unit
				? await client.models.LearningUnit.update({ id: unit.id, ...fields })
				: await client.models.LearningUnit.create(fields),
		);
		// Files removed in the form are deleted only once the change is saved.
		const kept = new Set(attachments.map((a) => a.s3Key));
		for (const old of compact(unit?.attachments)) {
			if (!kept.has(old.s3Key)) await deleteFile(old.s3Key);
		}
		await done();
	}

	async function remove() {
		if (!unit || !window.confirm(`Delete "${unit.title}"?`)) return;
		unwrap(await client.models.LearningUnit.delete({ id: unit.id }));
		for (const a of compact(unit.attachments)) await deleteFile(a.s3Key);
		await done();
	}

	return (
		<Modal
			title={unit ? "Edit learning unit" : "Add learning unit"}
			onClose={onDone}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (title.trim()) run(save);
				}}
				className="space-y-4"
			>
				<label className="block">
					<span className={labelClass}>Topic or theme</span>
					<input
						required
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Vegetable gardens"
						className={inputClass}
					/>
				</label>
				<label className="block">
					<span className={labelClass}>Where</span>
					<input
						value={source}
						onChange={(e) => setSource(e.target.value)}
						list="unit-sources"
						placeholder="Preschool"
						className={inputClass}
					/>
					<datalist id="unit-sources">
						{sources.map((s) => (
							<option key={s} value={s} />
						))}
					</datalist>
				</label>
				<div>
					<span className={labelClass}>For</span>
					<ChildPicker
						options={children.filter((c) => !c.archived)}
						value={childIds}
						onChange={setChildIds}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<label>
						<span className={labelClass}>From</span>
						<input
							type="date"
							required
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className={inputClass}
						/>
					</label>
					<label>
						<span className={labelClass}>To</span>
						<input
							type="date"
							required
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className={inputClass}
						/>
					</label>
				</div>
				<label className="block">
					<span className={labelClass}>Topics</span>
					<input
						value={topics}
						onChange={(e) => setTopics(e.target.value)}
						placeholder="parts of a plant, seeds, letter G"
						className={inputClass}
					/>
				</label>
				<label className="block">
					<span className={labelClass}>Notes</span>
					<textarea
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						rows={3}
						placeholder="Anything from the teacher: songs, books, vocabulary…"
						className={inputClass}
					/>
				</label>
				<div>
					<span className={labelClass}>Attachments</span>
					{attachments.length > 0 && (
						<ul className="mb-2 space-y-1.5">
							{attachments.map((a) => (
								<li
									key={a.s3Key}
									className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
								>
									<button
										type="button"
										onClick={() => openFile(a.s3Key)}
										className="flex-1 truncate text-left text-indigo-600 hover:underline"
									>
										{a.name}
									</button>
									<button
										type="button"
										onClick={() =>
											setAttachments((list) =>
												list.filter((x) => x.s3Key !== a.s3Key),
											)
										}
										aria-label={`Remove ${a.name}`}
										className="rounded p-0.5 text-slate-400 hover:text-red-600"
									>
										<X className="h-4 w-4" />
									</button>
								</li>
							))}
						</ul>
					)}
					<label className="flex items-center gap-2 text-sm text-slate-600">
						<Paperclip className="h-4 w-4 text-slate-400" />
						<input
							type="file"
							multiple
							disabled={busy}
							onChange={(e) => {
								const files = Array.from(e.target.files ?? []);
								e.target.value = "";
								run(async () => {
									for (const file of files) {
										const uploaded = await uploadFile(file);
										setAttachments((list) => [...list, uploaded]);
									}
								});
							}}
							className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
						/>
					</label>
					<p className="mt-1 text-xs text-slate-400">
						Newsletters, photos of the classroom board, worksheets. The tutor
						will be able to read these.
					</p>
				</div>
				<ErrorText error={error} />
				<div className="flex items-center gap-2 border-t border-slate-100 pt-4">
					{unit && (
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
						{busy ? "Saving…" : unit ? "Save" : "Add"}
					</button>
				</div>
			</form>
		</Modal>
	);
}

function UnitsPage() {
	const [editing, setEditing] = useState<LearningUnit | "new" | null>(null);
	const today = toDateKey(new Date());
	const { data: units = [], isLoading } = useQuery({
		queryKey: ["learningUnits"],
		queryFn: listLearningUnits,
	});
	const { data: children = [] } = useQuery({
		queryKey: ["children"],
		queryFn: listChildren,
	});

	const sources = [
		...new Set(units.map((u) => u.source).filter((s): s is string => !!s)),
	];
	const groups = [
		{
			label: "Now",
			units: units.filter((u) => u.startDate <= today && today <= u.endDate),
		},
		{
			label: "Coming up",
			units: units.filter((u) => u.startDate > today).reverse(),
		},
		{ label: "Past", units: units.filter((u) => u.endDate < today) },
	].filter((g) => g.units.length > 0);

	return (
		<Section
			title="Learning units"
			description="What the kids are covering at preschool, school or elsewhere, so home activities can reinforce it."
			action={
				<button
					type="button"
					onClick={() => setEditing("new")}
					className={primaryButtonClass}
				>
					Add unit
				</button>
			}
		>
			{isLoading && <p className="text-sm text-slate-400">Loading…</p>}
			{!isLoading && units.length === 0 && (
				<p className="text-sm text-slate-400">
					Nothing yet. Add this week's preschool theme to get started.
				</p>
			)}
			<div className="space-y-5">
				{groups.map((group) => (
					<div key={group.label}>
						<p className={labelClass}>{group.label}</p>
						<div className="space-y-2">
							{group.units.map((unit) => {
								const kids = children.filter((c) =>
									compact(unit.childIds).includes(c.id),
								);
								const files = compact(unit.attachments).length;
								return (
									<div
										key={unit.id}
										className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"
									>
										<div className="min-w-0 flex-1">
											<p className="font-semibold text-slate-700">
												{unit.title}
												{kids.map((c) => (
													<span
														key={c.id}
														className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${colorClasses(c.color).bg} ${colorClasses(c.color).text}`}
													>
														{c.name}
													</span>
												))}
											</p>
											<p className="truncate text-xs text-slate-500">
												{[
													unit.source,
													`${formatShortDate(unit.startDate)} – ${formatShortDate(unit.endDate)}`,
													compact(unit.topics).join(", "),
													files > 0 && `${files} file${files === 1 ? "" : "s"}`,
												]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</div>
										<button
											type="button"
											onClick={() => setEditing(unit)}
											aria-label={`Edit ${unit.title}`}
											className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
										>
											<Pencil className="h-4 w-4" />
										</button>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>

			{editing && (
				<UnitEditor
					unit={editing === "new" ? null : editing}
					sources={sources}
					onDone={() => setEditing(null)}
				/>
			)}
		</Section>
	);
}
