import { defineFunction } from "@aws-amplify/backend";

// AppSync resolver for household member management. It lives in the auth
// stack (not data) because it needs Cognito admin permissions: placing it in
// data creates an auth <-> data circular dependency.
export const manageMembers = defineFunction({
	name: "manage-members",
	resourceGroupName: "auth",
});
