import { defineFunction } from "@aws-amplify/backend";
import { modelEnvironment } from "../tutor-core/environment";

// Hourly household jobs (planner, reminders, notification delivery), plus the
// push and draft operations the app calls. See ./handler.ts.
export const householdJobs = defineFunction({
	name: "household-jobs",
	entry: "./handler.ts",
	// Grouped with data: it's an AppSync resolver with data access.
	resourceGroupName: "data",
	schedule: "every 1h",
	timeoutSeconds: 900,
	memoryMB: 1024,
	environment: modelEnvironment,
});
