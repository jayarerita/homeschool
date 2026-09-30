import { defineAuth } from "@aws-amplify/backend";
import { ALL_GROUPS } from "./groups";
import { manageMembers } from "./manage-members/resource";
import { postConfirmation } from "./post-confirmation/resource";
import { preSignUp } from "./pre-sign-up/resource";

export const auth = defineAuth({
	loginWith: {
		email: {
			userInvitation: {
				emailSubject: "You're invited to Homeschool",
				emailBody: (user, code) =>
					`You've been added to your family's Homeschool app. Sign in with ${user()} and this temporary password: ${code()}`,
			},
		},
	},
	userAttributes: {
		email: {
			required: true,
		},
	},
	groups: ALL_GROUPS,
	triggers: {
		preSignUp,
		postConfirmation,
	},
	access: (allow) => [
		allow.resource(preSignUp).to(["listUsersInGroup"]),
		allow.resource(postConfirmation).to(["listUsersInGroup", "addUserToGroup"]),
		allow
			.resource(manageMembers)
			.to([
				"listUsers",
				"listUsersInGroup",
				"listGroupsForUser",
				"createUser",
				"deleteUser",
				"addUserToGroup",
				"removeUserFromGroup",
			]),
	],
});
