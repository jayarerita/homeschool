// DayPlan.summary is set by the planner when a draft finishes; when drafting
// fails it holds this prefix and the reason, which the app shows as an error.
export const DRAFT_FAILED_PREFIX = "The draft didn't finish: ";

export function draftFailure(
	summary: string | null | undefined,
): string | null {
	return summary?.startsWith(DRAFT_FAILED_PREFIX)
		? summary.slice(DRAFT_FAILED_PREFIX.length)
		: null;
}
