import { defineStorage } from "@aws-amplify/backend";
import { GROUPS } from "../auth/groups";

// Household files: worksheets, preschool newsletters, photos. Keys look like
// uploads/<uuid>/<file name>; see src/lib/files.ts.
//
// Storage access comes from the IAM role of the user's highest-precedence
// Cognito group, and ADMIN outranks PARENT. Admins are always parents too, so
// ADMIN must be granted everything PARENT is, or admins get no file access.
export const storage = defineStorage({
	name: "householdFiles",
	access: (allow) => ({
		"uploads/*": [
			allow
				.groups([GROUPS.admin, GROUPS.parent])
				.to(["read", "write", "delete"]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		],
	}),
});
