import { describe, expect, it } from "vitest";
import { normalizeGroups, rolesToGroups } from "./groups";

describe("normalizeGroups", () => {
	it("accepts a single base role", () => {
		expect(normalizeGroups(["PARENT"])).toEqual(["PARENT"]);
		expect(normalizeGroups(["CHILD"])).toEqual(["CHILD"]);
		expect(normalizeGroups(["DEVICE"])).toEqual(["DEVICE"]);
	});

	it("accepts admin parents in canonical order", () => {
		expect(normalizeGroups(["PARENT", "ADMIN"])).toEqual(["ADMIN", "PARENT"]);
	});

	it("rejects admin without parent", () => {
		expect(() => normalizeGroups(["ADMIN"])).toThrow(/exactly one/);
		expect(() => normalizeGroups(["ADMIN", "CHILD"])).toThrow(/Only parents/);
	});

	it("rejects multiple base roles or unknown groups", () => {
		expect(() => normalizeGroups(["PARENT", "CHILD"])).toThrow(/exactly one/);
		expect(() => normalizeGroups(["PARENT", "ROOT"])).toThrow(/Unknown/);
	});
});

describe("rolesToGroups", () => {
	it("ignores the admin flag for non-parents", () => {
		expect(rolesToGroups("CHILD", true)).toEqual(["CHILD"]);
		expect(rolesToGroups("PARENT", true)).toEqual(["ADMIN", "PARENT"]);
	});
});
