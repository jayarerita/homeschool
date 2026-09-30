import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Archive,
	ArchiveRestore,
	ChevronDown,
	ChevronUp,
	Pencil,
} from "lucide-react";
import { useState } from "react";
import ColorPicker from "~/components/ColorPicker";
import Section, {
	ErrorText,
	inputClass,
	labelClass,
	primaryButtonClass,
	secondaryButtonClass,
} from "~/components/Section";
import { type Child, listChildren } from "~/lib/agenda";
import { type ColorToken, colorClasses, nextUnusedColor } from "~/lib/colors";
import { client, unwrap } from "~/lib/data-client";

type ChildDraft = {
	name: string;
	emoji: string;
	color: ColorToken;
	birthdate: string;
	gradeLevel: string;
	interests: string;
	notes: string;
};

function toDraft(child: Child): ChildDraft {
	return {
		name: child.name,
		emoji: child.emoji ?? "",
		color: child.color,
		birthdate: child.birthdate ?? "",
		gradeLevel: child.gradeLevel ?? "",
		interests: (child.interests ?? []).filter(Boolean).join(", "),
		notes: child.notes ?? "",
	};
}

// Empty strings become null so clearing a field removes it.
function fromDraft(draft: ChildDraft) {
	const interests = draft.interests
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return {
		name: draft.name.trim(),
		emoji: draft.emoji.trim() || null,
		color: draft.color,
		birthdate: draft.birthdate || null,
		gradeLevel: draft.gradeLevel.trim() || null,
		interests: interests.length > 0 ? interests : null,
		notes: draft.notes.trim() || null,
	};
}

export function ageFrom(birthdate: string, today = new Date()): number {
	const [y, m, d] = birthdate.split("-").map(Number);
	let age = today.getFullYear() - y;
	if (
		today.getMonth() + 1 < m ||
		(today.getMonth() + 1 === m && today.getDate() < d)
	) {
		age -= 1;
	}
	return age;
}

function ChildForm({
	initial,
	saving,
	error,
	onSave,
	onCancel,
}: {
	initial: ChildDraft;
	saving: boolean;
	error: unknown;
	onSave: (draft: ChildDraft) => void;
	onCancel: () => void;
}) {
	const [draft, setDraft] = useState(initial);
	const set = <K extends keyof ChildDraft>(key: K, value: ChildDraft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (draft.name.trim()) onSave(draft);
			}}
			className="space-y-4 rounded-2xl bg-slate-50 p-4"
		>
			<div className="grid grid-cols-[1fr_5rem] gap-3">
				<label>
					<span className={labelClass}>Name</span>
					<input
						required
						value={draft.name}
						onChange={(e) => set("name", e.target.value)}
						className={inputClass}
					/>
				</label>
				<label>
					<span className={labelClass}>Emoji</span>
					<input
						value={draft.emoji}
						onChange={(e) => set("emoji", e.target.value)}
						placeholder="🚀"
						className={`${inputClass} text-center`}
					/>
				</label>
			</div>
			<div>
				<span className={labelClass}>Label color</span>
				<ColorPicker value={draft.color} onChange={(c) => set("color", c)} />
			</div>
			<div className="grid grid-cols-2 gap-3">
				<label>
					<span className={labelClass}>Birthday</span>
					<input
						type="date"
						value={draft.birthdate}
						onChange={(e) => set("birthdate", e.target.value)}
						className={inputClass}
					/>
				</label>
				<label>
					<span className={labelClass}>Grade / level</span>
					<input
						value={draft.gradeLevel}
						onChange={(e) => set("gradeLevel", e.target.value)}
						placeholder="Preschool"
						className={inputClass}
					/>
				</label>
			</div>
			<label className="block">
				<span className={labelClass}>Interests</span>
				<input
					value={draft.interests}
					onChange={(e) => set("interests", e.target.value)}
					placeholder="dinosaurs, gardening, trains"
					className={inputClass}
				/>
			</label>
			<label className="block">
				<span className={labelClass}>Notes for the tutor</span>
				<textarea
					value={draft.notes}
					onChange={(e) => set("notes", e.target.value)}
					rows={3}
					placeholder="Learning style, things that help them focus, anything the tutor should know."
					className={inputClass}
				/>
			</label>
			<ErrorText error={error} />
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className={secondaryButtonClass}
				>
					Cancel
				</button>
				<button type="submit" disabled={saving} className={primaryButtonClass}>
					{saving ? "Saving…" : "Save"}
				</button>
			</div>
		</form>
	);
}

export default function ChildrenSettings() {
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState<string | "new" | null>(null);

	const {
		data: children = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["children"],
		queryFn: listChildren,
	});
	const active = children.filter((c) => !c.archived);
	const archived = children.filter((c) => c.archived);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["children"] });
		queryClient.invalidateQueries({ queryKey: ["agenda"] });
	};

	const save = useMutation({
		mutationFn: async ({ id, draft }: { id?: string; draft: ChildDraft }) => {
			if (id) {
				return unwrap(
					await client.models.Child.update({ id, ...fromDraft(draft) }),
				);
			}
			const sortOrder = Math.max(0, ...children.map((c) => c.sortOrder)) + 1;
			return unwrap(
				await client.models.Child.create({ ...fromDraft(draft), sortOrder }),
			);
		},
		onSuccess: () => {
			setEditing(null);
			invalidate();
		},
	});

	const update = useMutation({
		mutationFn: async (
			changes: { id: string; archived?: boolean; sortOrder?: number }[],
		) => {
			for (const change of changes) {
				unwrap(await client.models.Child.update(change));
			}
		},
		onSuccess: invalidate,
	});

	// Swap with the neighbour; renumber everyone so ties can't stick.
	function move(index: number, delta: -1 | 1) {
		const order = [...active];
		const target = index + delta;
		if (target < 0 || target >= order.length) return;
		[order[index], order[target]] = [order[target], order[index]];
		update.mutate(
			order
				.map((c, i) => ({ id: c.id, sortOrder: i + 1, current: c.sortOrder }))
				.filter((c) => c.sortOrder !== c.current)
				.map(({ id, sortOrder }) => ({ id, sortOrder })),
		);
	}

	const newDraft: ChildDraft = {
		name: "",
		emoji: "",
		color: nextUnusedColor(children.map((c) => c.color)),
		birthdate: "",
		gradeLevel: "",
		interests: "",
		notes: "",
	};

	return (
		<Section
			title="Children"
			description="Names, label colors and details the tutor uses to tailor activities."
			action={
				editing === null && (
					<button
						type="button"
						onClick={() => {
							save.reset();
							setEditing("new");
						}}
						className={primaryButtonClass}
					>
						Add child
					</button>
				)
			}
		>
			{isLoading && <p className="text-sm text-slate-400">Loading…</p>}
			<ErrorText error={error ?? update.error} />

			<div className="space-y-3">
				{editing === "new" && (
					<ChildForm
						initial={newDraft}
						saving={save.isPending}
						error={save.error}
						onSave={(draft) => save.mutate({ draft })}
						onCancel={() => setEditing(null)}
					/>
				)}

				{active.length === 0 && !isLoading && editing !== "new" && (
					<p className="text-sm text-slate-400">No children added yet.</p>
				)}

				{active.map((child, index) =>
					editing === child.id ? (
						<ChildForm
							key={child.id}
							initial={toDraft(child)}
							saving={save.isPending}
							error={save.error}
							onSave={(draft) => save.mutate({ id: child.id, draft })}
							onCancel={() => setEditing(null)}
						/>
					) : (
						<ChildRow
							key={child.id}
							child={child}
							busy={update.isPending}
							onEdit={() => {
								save.reset();
								setEditing(child.id);
							}}
							onArchive={() =>
								update.mutate([{ id: child.id, archived: true }])
							}
							onUp={index > 0 ? () => move(index, -1) : undefined}
							onDown={
								index < active.length - 1 ? () => move(index, 1) : undefined
							}
						/>
					),
				)}
			</div>

			{archived.length > 0 && (
				<div className="mt-5 border-t border-slate-100 pt-4">
					<p className={labelClass}>Archived</p>
					<div className="space-y-2">
						{archived.map((child) => (
							<ChildRow
								key={child.id}
								child={child}
								busy={update.isPending}
								onRestore={() =>
									update.mutate([{ id: child.id, archived: false }])
								}
							/>
						))}
					</div>
				</div>
			)}
		</Section>
	);
}

function ChildRow({
	child,
	busy,
	onEdit,
	onArchive,
	onRestore,
	onUp,
	onDown,
}: {
	child: Child;
	busy: boolean;
	onEdit?: () => void;
	onArchive?: () => void;
	onRestore?: () => void;
	onUp?: () => void;
	onDown?: () => void;
}) {
	const colors = colorClasses(child.color);
	const details = [
		child.birthdate && `Age ${ageFrom(child.birthdate)}`,
		child.gradeLevel,
		child.interests?.filter(Boolean).join(", "),
	].filter(Boolean);
	const iconButton =
		"rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30";

	return (
		<div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
			<span
				className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xl ${colors.bg}`}
			>
				{child.emoji || child.name.charAt(0)}
			</span>
			<div className="min-w-0 flex-1">
				<span
					className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${colors.bg} ${colors.text}`}
				>
					{child.name}
				</span>
				{details.length > 0 && (
					<p className="mt-1 truncate text-xs text-slate-500">
						{details.join(" · ")}
					</p>
				)}
			</div>
			<div className="flex items-center">
				{(onUp || onDown) && (
					<>
						<button
							type="button"
							onClick={onUp}
							disabled={!onUp || busy}
							aria-label={`Move ${child.name} up`}
							className={iconButton}
						>
							<ChevronUp className="h-4 w-4" />
						</button>
						<button
							type="button"
							onClick={onDown}
							disabled={!onDown || busy}
							aria-label={`Move ${child.name} down`}
							className={iconButton}
						>
							<ChevronDown className="h-4 w-4" />
						</button>
					</>
				)}
				{onEdit && (
					<button
						type="button"
						onClick={onEdit}
						aria-label={`Edit ${child.name}`}
						className={iconButton}
					>
						<Pencil className="h-4 w-4" />
					</button>
				)}
				{onArchive && (
					<button
						type="button"
						onClick={onArchive}
						disabled={busy}
						aria-label={`Archive ${child.name}`}
						title="Archive (hides from the agenda, keeps history)"
						className={iconButton}
					>
						<Archive className="h-4 w-4" />
					</button>
				)}
				{onRestore && (
					<button
						type="button"
						onClick={onRestore}
						disabled={busy}
						aria-label={`Restore ${child.name}`}
						title="Restore"
						className={iconButton}
					>
						<ArchiveRestore className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);
}
