// Cognito groups. Shared by the auth resource, its triggers, and the frontend.
export const GROUPS = {
	parent: "PARENT",
	child: "CHILD",
	device: "DEVICE",
} as const;

export type Group = (typeof GROUPS)[keyof typeof GROUPS];
