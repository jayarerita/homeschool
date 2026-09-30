import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";

// Data (DynamoDB models) is added in phase 2 — see docs/ARCHITECTURE.md.
export const backend = defineBackend({
	auth,
});
