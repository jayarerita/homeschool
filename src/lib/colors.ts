import { COLOR_TOKENS, type ColorToken } from "../../amplify/data/colors";

export { COLOR_TOKENS, type ColorToken };

type ColorClasses = {
	bg: string;
	text: string;
	border: string;
	activeBg: string;
};

// Class names are spelled out in full so Tailwind can find them at build time.
export const COLOR_CLASSES: Record<ColorToken, ColorClasses> = {
	slate: {
		bg: "bg-slate-100",
		text: "text-slate-700",
		border: "border-slate-300",
		activeBg: "bg-slate-500",
	},
	red: {
		bg: "bg-red-100",
		text: "text-red-700",
		border: "border-red-300",
		activeBg: "bg-red-500",
	},
	orange: {
		bg: "bg-orange-100",
		text: "text-orange-700",
		border: "border-orange-300",
		activeBg: "bg-orange-500",
	},
	amber: {
		bg: "bg-amber-100",
		text: "text-amber-700",
		border: "border-amber-300",
		activeBg: "bg-amber-500",
	},
	yellow: {
		bg: "bg-yellow-100",
		text: "text-yellow-700",
		border: "border-yellow-300",
		activeBg: "bg-yellow-500",
	},
	lime: {
		bg: "bg-lime-100",
		text: "text-lime-700",
		border: "border-lime-300",
		activeBg: "bg-lime-500",
	},
	green: {
		bg: "bg-green-100",
		text: "text-green-700",
		border: "border-green-300",
		activeBg: "bg-green-500",
	},
	emerald: {
		bg: "bg-emerald-100",
		text: "text-emerald-700",
		border: "border-emerald-300",
		activeBg: "bg-emerald-500",
	},
	teal: {
		bg: "bg-teal-100",
		text: "text-teal-700",
		border: "border-teal-300",
		activeBg: "bg-teal-500",
	},
	sky: {
		bg: "bg-sky-100",
		text: "text-sky-700",
		border: "border-sky-300",
		activeBg: "bg-sky-500",
	},
	blue: {
		bg: "bg-blue-100",
		text: "text-blue-700",
		border: "border-blue-300",
		activeBg: "bg-blue-500",
	},
	indigo: {
		bg: "bg-indigo-100",
		text: "text-indigo-700",
		border: "border-indigo-300",
		activeBg: "bg-indigo-500",
	},
	violet: {
		bg: "bg-violet-100",
		text: "text-violet-700",
		border: "border-violet-300",
		activeBg: "bg-violet-500",
	},
	purple: {
		bg: "bg-purple-100",
		text: "text-purple-700",
		border: "border-purple-300",
		activeBg: "bg-purple-500",
	},
	pink: {
		bg: "bg-pink-100",
		text: "text-pink-700",
		border: "border-pink-300",
		activeBg: "bg-pink-500",
	},
	rose: {
		bg: "bg-rose-100",
		text: "text-rose-700",
		border: "border-rose-300",
		activeBg: "bg-rose-500",
	},
};

export function colorClasses(
	token: ColorToken | null | undefined,
): ColorClasses {
	return COLOR_CLASSES[token ?? "slate"];
}

// The first palette color not already used, so new children get distinct colors.
export function nextUnusedColor(
	used: readonly (ColorToken | null | undefined)[],
): ColorToken {
	const preferred: ColorToken[] = [
		"pink",
		"sky",
		"amber",
		"violet",
		"emerald",
		"orange",
		"teal",
		"rose",
	];
	return (
		preferred.find((c) => !used.includes(c)) ??
		COLOR_TOKENS.find((c) => !used.includes(c)) ??
		"slate"
	);
}
