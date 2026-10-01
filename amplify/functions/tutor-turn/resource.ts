import { defineFunction } from "@aws-amplify/backend";
import { modelEnvironment } from "../tutor-core/environment";

export const tutorTurn = defineFunction({
	name: "tutor-turn",
	entry: "./handler.ts",
	// Grouped with data: it's an AppSync resolver with data access.
	resourceGroupName: "data",
	timeoutSeconds: 600,
	memoryMB: 1024,
	environment: modelEnvironment,
});
