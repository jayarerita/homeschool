import type { Child } from "~/lib/agenda";
import { colorClasses } from "~/lib/colors";

// Multi-select chips. An empty selection means "everyone".
export default function ChildPicker({
	options,
	value,
	onChange,
}: {
	options: Child[];
	value: string[];
	onChange: (ids: string[]) => void;
}) {
	if (options.length === 0) {
		return (
			<p className="text-sm text-slate-400">
				Add children in Settings to assign activities.
			</p>
		);
	}
	return (
		<div className="flex flex-wrap gap-2">
			{options.map((child) => {
				const selected = value.includes(child.id);
				const colors = colorClasses(child.color);
				return (
					<button
						key={child.id}
						type="button"
						aria-pressed={selected}
						onClick={() =>
							onChange(
								selected
									? value.filter((id) => id !== child.id)
									: [...value, child.id],
							)
						}
						className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
							selected
								? `${colors.activeBg} text-white`
								: `${colors.bg} ${colors.text} opacity-60 hover:opacity-100`
						}`}
					>
						{child.emoji && <span className="mr-1">{child.emoji}</span>}
						{child.name}
					</button>
				);
			})}
			<span className="self-center text-xs text-slate-400">
				{value.length === 0 ? "Everyone" : ""}
			</span>
		</div>
	);
}
