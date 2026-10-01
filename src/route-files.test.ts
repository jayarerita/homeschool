import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// TanStack Router's file watcher writes a placeholder component into any route
// file it sees empty (for example mid-save). It type-checks and builds fine,
// so guard against shipping one.
function routeFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return routeFiles(path);
		return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")
			? [path]
			: [];
	});
}

describe("route files", () => {
	it.each(routeFiles("src/routes"))(
		"%s is not a generated placeholder",
		(file) => {
			expect(readFileSync(file, "utf8")).not.toMatch(/return <div>Hello "/);
		},
	);
});
