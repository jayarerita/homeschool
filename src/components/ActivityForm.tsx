import { useState } from "react";
import ChildPicker from "~/components/ChildPicker";
import ColorPicker from "~/components/ColorPicker";
import ResourceListEditor, {
	type ResourceDraft,
	toResourceDrafts,
} from "~/components/ResourceListEditor";
import {
	ErrorText,
	inputClass,
	labelClass,
	primaryButtonClass,
	secondaryButtonClass,
} from "~/components/Section";
import type { Child, Resource } from "~/lib/agenda";
import type { ColorToken } from "~/lib/colors";
import { compact } from "~/lib/planning";

// The fields agenda items and routines share.
export type ActivityDraft = {
	title: string;
	emoji: string;
	color: ColorToken;
	startTime: string;
	endTime: string;
	description: string;
	childIds: string[];
	resources: ResourceDraft[];
};

type ActivityRecord = {
	title: string;
	emoji?: string | null;
	color?: ColorToken | null;
	startTime?: string | null;
	endTime?: string | null;
	description?: string | null;
	childIds?: readonly (string | null)[] | null;
	resources?: readonly (Resource | null | undefined)[] | null;
};

export function toActivityDraft(record?: ActivityRecord): ActivityDraft {
	return {
		title: record?.title ?? "",
		emoji: record?.emoji ?? "",
		color: record?.color ?? "indigo",
		startTime: record?.startTime ?? "",
		endTime: record?.endTime ?? "",
		description: record?.description ?? "",
		childIds: compact(record?.childIds),
		resources: toResourceDrafts(record?.resources),
	};
}

// What gets written to AgendaItem/Routine records.
export type ActivityFields = {
	title: string;
	emoji: string | null;
	color: ColorToken | null;
	startTime: string | null;
	endTime: string | null;
	description: string | null;
	childIds: string[] | null;
	resources: ResourceDraft[] | null;
};

// Empty strings/lists become null so clearing a field removes it.
export function fromActivityDraft(draft: ActivityDraft): ActivityFields {
	return {
		title: draft.title.trim(),
		emoji: draft.emoji.trim() || null,
		color: draft.color,
		startTime: draft.startTime || null,
		endTime: draft.endTime || null,
		description: draft.description.trim() || null,
		childIds: draft.childIds.length > 0 ? draft.childIds : null,
		resources: draft.resources.length > 0 ? draft.resources : null,
	};
}

export default function ActivityForm({
	initial,
	household,
	submitLabel = "Save",
	extra,
	onSubmit,
	onCancel,
	onDelete,
}: {
	initial: ActivityDraft;
	household: Child[];
	submitLabel?: string;
	extra?: React.ReactNode;
	onSubmit: (draft: ActivityDraft) => Promise<unknown>;
	onCancel: () => void;
	onDelete?: () => Promise<unknown>;
}) {
	const [draft, setDraft] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const set = <K extends keyof ActivityDraft>(
		key: K,
		value: ActivityDraft[K],
	) => setDraft((d) => ({ ...d, [key]: value }));

	async function run(action: () => Promise<unknown>) {
		setBusy(true);
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(e);
			setBusy(false);
		}
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (
					draft.endTime &&
					draft.startTime &&
					draft.endTime < draft.startTime
				) {
					setError(new Error("The end time is before the start time."));
					return;
				}
				if (draft.title.trim()) run(() => onSubmit(draft));
			}}
			className="space-y-4"
		>
			<div className="grid grid-cols-[1fr_5rem] gap-3">
				<label>
					<span className={labelClass}>Title</span>
					<input
						required
						value={draft.title}
						onChange={(e) => set("title", e.target.value)}
						className={inputClass}
					/>
				</label>
				<label>
					<span className={labelClass}>Emoji</span>
					<input
						value={draft.emoji}
						onChange={(e) => set("emoji", e.target.value)}
						placeholder="🎨"
						className={`${inputClass} text-center`}
					/>
				</label>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<label>
					<span className={labelClass}>Start</span>
					<input
						type="time"
						value={draft.startTime}
						onChange={(e) => set("startTime", e.target.value)}
						className={inputClass}
					/>
				</label>
				<label>
					<span className={labelClass}>End</span>
					<input
						type="time"
						value={draft.endTime}
						onChange={(e) => set("endTime", e.target.value)}
						className={inputClass}
					/>
				</label>
			</div>
			{extra}
			<div>
				<span className={labelClass}>For</span>
				<ChildPicker
					options={household}
					value={draft.childIds}
					onChange={(ids) => set("childIds", ids)}
				/>
			</div>
			<label className="block">
				<span className={labelClass}>Description</span>
				<textarea
					value={draft.description}
					onChange={(e) => set("description", e.target.value)}
					rows={3}
					className={inputClass}
				/>
			</label>
			<ResourceListEditor
				value={draft.resources}
				onChange={(resources) => set("resources", resources)}
			/>
			<div>
				<span className={labelClass}>Color</span>
				<ColorPicker value={draft.color} onChange={(c) => set("color", c)} />
			</div>
			<ErrorText error={error} />
			<div className="flex items-center gap-2 border-t border-slate-100 pt-4">
				{onDelete && (
					<button
						type="button"
						disabled={busy}
						onClick={() => {
							if (window.confirm(`Delete "${draft.title}"?`)) run(onDelete);
						}}
						className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
					>
						Delete
					</button>
				)}
				<div className="flex-1" />
				<button
					type="button"
					onClick={onCancel}
					className={secondaryButtonClass}
				>
					Cancel
				</button>
				<button type="submit" disabled={busy} className={primaryButtonClass}>
					{busy ? "Saving…" : submitLabel}
				</button>
			</div>
		</form>
	);
}
