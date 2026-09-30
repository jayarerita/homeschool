// Cognito groups. Shared by the auth resource, its triggers, the data API, and
// the frontend.
//
// ADMIN is an add-on to PARENT: admins can also manage household members. The
// first confirmed user gets both.
export const GROUPS = {
	admin: "ADMIN",
	parent: "PARENT",
	child: "CHILD",
	device: "DEVICE",
} as const;

export type Group = (typeof GROUPS)[keyof typeof GROUPS];

export const ALL_GROUPS: Group[] = Object.values(GROUPS);

export function isGroup(value: string): value is Group {
	return (ALL_GROUPS as string[]).includes(value);
}

// Every member has exactly one base role. ADMIN is only valid on a PARENT.
export const BASE_ROLES = [GROUPS.parent, GROUPS.child, GROUPS.device] as const;
export type BaseRole = (typeof BASE_ROLES)[number];

export function rolesToGroups(role: BaseRole, admin: boolean): Group[] {
	return role === GROUPS.parent && admin
		? [GROUPS.admin, GROUPS.parent]
		: [role];
}

// Validates a requested group set and returns it in canonical form, or throws.
export function normalizeGroups(requested: readonly string[]): Group[] {
	const unknown = requested.filter((g) => !isGroup(g));
	if (unknown.length > 0) {
		throw new Error(`Unknown group(s): ${unknown.join(", ")}`);
	}
	const bases = BASE_ROLES.filter((r) => requested.includes(r));
	if (bases.length !== 1) {
		throw new Error("A member needs exactly one of PARENT, CHILD or DEVICE.");
	}
	const admin = requested.includes(GROUPS.admin);
	if (admin && bases[0] !== GROUPS.parent) {
		throw new Error("Only parents can be admins.");
	}
	return rolesToGroups(bases[0], admin);
}
