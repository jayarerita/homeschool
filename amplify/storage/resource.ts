import { defineStorage } from "@aws-amplify/backend";
import { GROUPS } from "../auth/groups";

// Household files: worksheets, preschool newsletters, photos. Keys look like
// uploads/<uuid>/<file name>; see src/lib/files.ts.
export const storage = defineStorage({
	name: "householdFiles",
	access: (allow) => ({
		"uploads/*": [
			allow.groups([GROUPS.parent]).to(["read", "write", "delete"]),
			allow.groups([GROUPS.child, GROUPS.device]).to(["read"]),
		],
	}),
});
