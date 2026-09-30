import { Check } from "lucide-react";
import { COLOR_CLASSES, COLOR_TOKENS, type ColorToken } from "~/lib/colors";

export default function ColorPicker({
	value,
	onChange,
}: {
	value: ColorToken;
	onChange: (color: ColorToken) => void;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{COLOR_TOKENS.map((token) => {
				const selected = token === value;
				return (
					<button
						key={token}
						type="button"
						aria-pressed={selected}
						aria-label={token}
						title={token}
						onClick={() => onChange(token)}
						className={`flex h-7 w-7 items-center justify-center rounded-full text-white transition ${COLOR_CLASSES[token].activeBg} ${
							selected
								? "ring-2 ring-slate-800 ring-offset-2"
								: "hover:scale-110"
						}`}
					>
						{selected && <Check className="h-3.5 w-3.5" />}
					</button>
				);
			})}
		</div>
	);
}
