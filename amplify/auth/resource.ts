import { defineAuth } from "@aws-amplify/backend";
import { GROUPS } from "./groups";
import { postConfirmation } from "./post-confirmation/resource";
import { preSignUp } from "./pre-sign-up/resource";

export const auth = defineAuth({
	loginWith: {
		email: true,
	},
	userAttributes: {
		email: {
			required: true,
		},
	},
	groups: [GROUPS.parent, GROUPS.child, GROUPS.device],
	triggers: {
		preSignUp,
		postConfirmation,
	},
	access: (allow) => [
		allow.resource(preSignUp).to(["listUsersInGroup"]),
		allow.resource(postConfirmation).to(["listUsersInGroup", "addUserToGroup"]),
	],
});
