import { describe, expect, it } from "vitest";
import { allowedInKidMode, itemsForChild, parentCheck } from "./kid-mode";

describe("kid mode", () => {
	it("only allows the child's own page and lessons", () => {
		expect(allowedInKidMode("/kid/ada", "ada")).toBe(true);
		expect(allowedInKidMode("/lesson/abc", "ada")).toBe(true);
		expect(allowedInKidMode("/kid/ben", "ada")).toBe(false);
		expect(allowedInKidMode("/settings", "ada")).toBe(false);
		expect(allowedInKidMode("/", "ada")).toBe(false);
	});

	it("asks a multiplication question with factors 6 to 9", () => {
		expect(parentCheck(() => 0)).toEqual({ question: "6 × 6", answer: 36 });
		expect(parentCheck(() => 0.99)).toEqual({ question: "9 × 9", answer: 81 });
	});

	it("shows a child their activities and shared ones", () => {
		const items = [
			{ id: 1, childIds: ["ada"] },
			{ id: 2, childIds: ["ben"] },
			{ id: 3, childIds: null },
			{ id: 4, childIds: [] },
			{ id: 5, childIds: ["ben", "ada"] },
		];
		expect(itemsForChild(items, "ada").map((i) => i.id)).toEqual([1, 3, 4, 5]);
	});
});
