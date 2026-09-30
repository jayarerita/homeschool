import { describe, expect, it } from "vitest";
import {
	compact,
	pendingRoutines,
	planInsert,
	planMove,
	splitList,
	unitsOn,
	weekdayOf,
} from "./planning";

const items = [
	{ id: "a", sortOrder: 10, startTime: "08:00" },
	{ id: "b", sortOrder: 20, startTime: "09:00" },
	{ id: "c", sortOrder: 30, startTime: null },
	{ id: "d", sortOrder: 40, startTime: "12:00" },
];

describe("planInsert", () => {
	it("appends when there is no start time", () => {
		expect(planInsert(items)).toEqual({ sortOrder: 50, renumber: [] });
		expect(planInsert([])).toEqual({ sortOrder: 10, renumber: [] });
	});

	it("goes before the first later item", () => {
		expect(planInsert(items, "08:30")).toEqual({ sortOrder: 15, renumber: [] });
		expect(planInsert(items, "07:00")).toEqual({ sortOrder: 5, renumber: [] });
	});

	it("goes after items at the same time", () => {
		expect(planInsert(items, "09:00").sortOrder).toBe(35);
	});

	it("appends when it's the latest", () => {
		expect(planInsert(items, "18:00").sortOrder).toBe(50);
	});

	it("renumbers when there is no gap", () => {
		const tight = [
			{ id: "a", sortOrder: 1, startTime: "08:00" },
			{ id: "b", sortOrder: 2, startTime: "09:00" },
		];
		expect(planInsert(tight, "08:30")).toEqual({
			sortOrder: 20,
			renumber: [
				{ id: "a", sortOrder: 10 },
				{ id: "b", sortOrder: 30 },
			],
		});
	});
});

describe("planMove", () => {
	it("swaps neighbours and renumbers only what changed", () => {
		expect(planMove(items, 1, 1)).toEqual([
			{ id: "c", sortOrder: 20 },
			{ id: "b", sortOrder: 30 },
		]);
	});

	it("ignores moves past either end", () => {
		expect(planMove(items, 0, -1)).toEqual([]);
		expect(planMove(items, 3, 1)).toEqual([]);
	});
});

describe("routines and units", () => {
	it("computes weekdays in local time", () => {
		expect(weekdayOf("2026-09-28")).toBe(1); // Monday
		expect(weekdayOf("2026-10-04")).toBe(0); // Sunday
	});

	const routines = [
		{ id: "lunch", daysOfWeek: [1, 2, 3, 4, 5], startTime: "12:00" },
		{ id: "wake", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: "07:00" },
		{ id: "paused", daysOfWeek: [1], active: false },
		{ id: "sunday", daysOfWeek: [0] },
	];

	it("returns active routines for the weekday, earliest first", () => {
		expect(
			pendingRoutines(routines, "2026-09-28", []).map((r) => r.id),
		).toEqual(["wake", "lunch"]);
	});

	it("skips routines already on the day", () => {
		expect(
			pendingRoutines(routines, "2026-09-28", [{ routineId: "wake" }]).map(
				(r) => r.id,
			),
		).toEqual(["lunch"]);
	});

	it("finds units covering a date, inclusive", () => {
		const units = [
			{ id: 1, startDate: "2026-09-01", endDate: "2026-09-30" },
			{ id: 2, startDate: "2026-10-01", endDate: "2026-10-07" },
		];
		expect(unitsOn(units, "2026-09-30").map((u) => u.id)).toEqual([1]);
		expect(unitsOn(units, "2026-10-01").map((u) => u.id)).toEqual([2]);
		expect(unitsOn(units, "2026-11-01")).toEqual([]);
	});
});

describe("list helpers", () => {
	it("splits and trims, returning null when empty", () => {
		expect(splitList(" a, b,, c ")).toEqual(["a", "b", "c"]);
		expect(splitList(" , ")).toBeNull();
		expect(splitList("one\ntwo", "\n")).toEqual(["one", "two"]);
	});

	it("drops nulls", () => {
		expect(compact([1, null, 2, undefined])).toEqual([1, 2]);
		expect(compact(null)).toEqual([]);
	});
});
