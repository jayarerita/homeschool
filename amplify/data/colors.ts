// Color tokens stored in DynamoDB for children and agenda items. The frontend
// maps each token to Tailwind classes in src/lib/colors.ts.
export const COLOR_TOKENS = [
	"slate",
	"red",
	"orange",
	"amber",
	"yellow",
	"lime",
	"green",
	"emerald",
	"teal",
	"sky",
	"blue",
	"indigo",
	"violet",
	"purple",
	"pink",
	"rose",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
