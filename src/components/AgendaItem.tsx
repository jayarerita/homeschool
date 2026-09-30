import {
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	FileText,
	Link,
	StickyNote,
	Video,
} from "lucide-react";
import { useState } from "react";
import type { AgendaItem, Child, Resource } from "~/lib/agenda";
import { CHILD_COLORS } from "~/lib/agenda";

const RESOURCE_ICONS = {
	pdf: FileText,
	video: Video,
	link: Link,
	note: StickyNote,
};

function ChildBadge({
	child,
	colorIndex,
}: {
	child: Child;
	colorIndex: number;
}) {
	const colors = CHILD_COLORS[colorIndex % CHILD_COLORS.length];
	return (
		<span
			className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${colors.bg} ${colors.text}`}
		>
			{child.emoji && <span>{child.emoji}</span>}
			{child.name}
		</span>
	);
}

function PromptRow({ prompt }: { prompt: string }) {
	const [expanded, setExpanded] = useState(false);
	const [copied, setCopied] = useState(false);

	const preview = prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt;

	function handleCopy() {
		navigator.clipboard.writeText(prompt);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<div className="flex items-start rounded-lg border border-slate-200 bg-slate-50 text-left text-xs">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex flex-1 items-start gap-1.5 p-2 text-left text-slate-600"
			>
				<ChevronRight
					className={`mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
				/>
				<span className="flex-1">{expanded ? prompt : preview}</span>
			</button>
			<button
				type="button"
				onClick={handleCopy}
				className="m-1.5 flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-indigo-500"
				title="Copy prompt"
			>
				{copied ? (
					<Check className="h-3 w-3 text-green-500" />
				) : (
					<Copy className="h-3 w-3" />
				)}
			</button>
		</div>
	);
}

function ResourceCard({
	resource,
	allChildren,
	activeChildId,
}: {
	resource: Resource;
	allChildren: Child[];
	activeChildId: string | null;
}) {
	const [open, setOpen] = useState(false);
	const Icon = RESOURCE_ICONS[resource.type];

	// Assigned children for this resource (only shown in "All" view)
	type FoundChild = { child: Child; index: number };
	const assignedChildren: FoundChild[] =
		!activeChildId && resource.childIds
			? resource.childIds.reduce<FoundChild[]>((acc, cid) => {
					const index = allChildren.findIndex((c) => c.id === cid);
					const child = allChildren[index];
					if (child) acc.push({ child, index });
					return acc;
				}, [])
			: [];

	const hasDetail =
		resource.description ||
		resource.url ||
		(resource.prompts && resource.prompts.length > 0);

	return (
		<div className="flex w-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:border-indigo-300 hover:shadow-md">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				className="flex w-full flex-col items-center"
			>
				<Icon className="mb-1 h-6 w-6 text-indigo-400" />
				<span className="text-[10px] font-bold leading-tight text-slate-500">
					{resource.label}
				</span>
				{assignedChildren.length > 0 && (
					<div className="mt-1.5 flex flex-wrap justify-center gap-1">
						{assignedChildren.map(({ child, index }) => (
							<ChildBadge key={child.id} child={child} colorIndex={index} />
						))}
					</div>
				)}
			</button>
			{open && hasDetail && (
				<div className="mt-2 w-full border-t border-slate-100 pt-2 text-left">
					{resource.description && (
						<p className="mb-2 text-xs text-slate-600">
							{resource.description}
						</p>
					)}
					{resource.url && (
						<a
							href={resource.url}
							target="_blank"
							rel="noopener noreferrer"
							className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:underline"
						>
							<Link className="h-3 w-3" />
							Open link
						</a>
					)}
					{resource.prompts && resource.prompts.length > 0 && (
						<>
							<p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
								AI Prompts
							</p>
							<div className="flex flex-col gap-1.5">
								{resource.prompts.map((prompt, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: prompts are static
									<PromptRow key={i} prompt={prompt} />
								))}
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}

export default function AgendaItemCard({
	item,
	allChildren = [],
	activeChildId = null,
}: {
	item: AgendaItem;
	allChildren?: Child[];
	activeChildId?: string | null;
}) {
	const [expanded, setExpanded] = useState(false);

	type FoundChild = { child: Child; index: number };
	// Assigned children for this item (shown in "All" view)
	const assignedChildren: FoundChild[] =
		!activeChildId && item.childIds
			? item.childIds.reduce<FoundChild[]>((acc, cid) => {
					const index = allChildren.findIndex((c) => c.id === cid);
					const child = allChildren[index];
					if (child) acc.push({ child, index });
					return acc;
				}, [])
			: [];

	// Filter resources based on active child
	const visibleResources = item.resources?.filter(
		(r) =>
			!r.childIds ||
			r.childIds.length === 0 ||
			(activeChildId ? r.childIds.includes(activeChildId) : true),
	);

	return (
		<div
			className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-all ${
				expanded ? "border-slate-200 shadow-md" : "border-slate-100"
			}`}
		>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className={`flex w-full items-center justify-between p-4 transition ${
					expanded ? "bg-blue-50/30" : "hover:bg-slate-50 active:bg-slate-100"
				}`}
			>
				<div className="flex items-center gap-4 min-w-0">
					<div
						className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xl ${item.iconBg}`}
					>
						{item.emoji}
					</div>
					<div className="flex flex-col items-start min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<span className="font-bold text-slate-700">{item.title}</span>
							{assignedChildren.map(({ child, index }) => (
								<ChildBadge key={child.id} child={child} colorIndex={index} />
							))}
						</div>
						{item.time && (
							<span className="text-xs text-slate-400">{item.time}</span>
						)}
					</div>
				</div>
				<ChevronDown
					className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
						expanded ? "rotate-180" : ""
					}`}
				/>
			</button>

			{expanded && (
				<div className="border-t border-slate-100 bg-slate-50 p-4">
					{item.time && (
						<>
							<p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
								Approximate Time
							</p>
							<p className="mb-3 text-slate-600">{item.time}</p>
						</>
					)}
					{item.description && (
						<>
							<p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
								Description
							</p>
							<p
								className={`text-slate-600 ${visibleResources?.length ? "mb-4" : ""}`}
							>
								{item.description}
							</p>
						</>
					)}
					{visibleResources && visibleResources.length > 0 && (
						<>
							<p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-500">
								Resources
							</p>
							<div className="grid grid-cols-2 gap-3">
								{visibleResources.map((r) => (
									<ResourceCard
										key={r.id}
										resource={r}
										allChildren={allChildren}
										activeChildId={activeChildId}
									/>
								))}
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}
