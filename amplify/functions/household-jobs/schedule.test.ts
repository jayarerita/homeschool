import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	dueJobs,
	inQuietHours,
	listPhrase,
	localClock,
	materialsFor,
	needsFeedback,
} from "./schedule";

describe("localClock", () => {
	it("reads the household's local date, hour and weekday", () => {
		// 01:30 UTC on Thu Oct 1 is 20:30 on Wed Sep 30 in Chicago (CDT).
		expect(
			localClock(new Date("2026-10-01T01:30:00Z"), "America/Chicago"),
		).toEqual({
			date: "2026-09-30",
			hour: 20,
			minute: 30,
			weekday: 3,
		});
	});

	it("uses hour 0 at midnight, not 24", () => {
		expect(localClock(new Date("2026-10-01T00:05:00Z"), "UTC").hour).toBe(0);
	});
});

describe("dueJobs", () => {
	const at = (hour: number, weekday = 3) => ({
		date: "2026-09-30",
		hour,
		minute: 0,
		weekday,
	});

	it("runs nothing early in the day", () => {
		expect(dueJobs(DEFAULT_SETTINGS, at(9))).toEqual([]);
	});

	it("adds jobs once their hour has passed", () => {
		expect(dueJobs(DEFAULT_SETTINGS, at(16)).map((j) => j.kind)).toEqual([
			"planner",
		]);
		expect(dueJobs(DEFAULT_SETTINGS, at(18)).map((j) => j.kind)).toEqual([
			"feedback",
			"planner",
		]);
		expect(dueJobs(DEFAULT_SETTINGS, at(21))).toEqual([
			{ kind: "feedback", date: "2026-09-30" },
			{ kind: "materials", date: "2026-10-01" },
			{ kind: "planner", dates: ["2026-10-01"] },
		]);
	});

	it("respects the planner switch and caps days ahead at 3", () => {
		expect(
			dueJobs({ ...DEFAULT_SETTINGS, plannerEnabled: false }, at(21)).map(
				(j) => j.kind,
			),
		).not.toContain("planner");
		expect(
			dueJobs({ ...DEFAULT_SETTINGS, planDaysAhead: 9 }, at(21)).find(
				(j) => j.kind === "planner",
			),
		).toEqual({
			kind: "planner",
			dates: ["2026-10-01", "2026-10-02", "2026-10-03"],
		});
	});

	it("sends the weekly preview only on its day", () => {
		expect(dueJobs(DEFAULT_SETTINGS, at(17, 0)).map((j) => j.kind)).toContain(
			"weekly_preview",
		);
		expect(
			dueJobs(DEFAULT_SETTINGS, at(17, 1)).map((j) => j.kind),
		).not.toContain("weekly_preview");
	});
});

describe("inQuietHours", () => {
	it("handles windows that wrap past midnight", () => {
		expect(inQuietHours(22, 21, 7)).toBe(true);
		expect(inQuietHours(3, 21, 7)).toBe(true);
		expect(inQuietHours(7, 21, 7)).toBe(false);
		expect(inQuietHours(12, 21, 7)).toBe(false);
	});

	it("handles same-day windows and unset hours", () => {
		expect(inQuietHours(13, 12, 14)).toBe(true);
		expect(inQuietHours(14, 12, 14)).toBe(false);
		expect(inQuietHours(3, null, 7)).toBe(false);
		expect(inQuietHours(3, 5, 5)).toBe(false);
	});
});

describe("materials and feedback", () => {
	const items = [
		{
			id: "a",
			title: "Collage",
			endTime: "10:00",
			resources: [
				{ label: "Glue stick", type: "material" },
				{ label: "Spring ideas", type: "link" },
			],
		},
		{
			id: "b",
			title: "Planting",
			endTime: "14:00",
			resources: [{ label: "glue stick ", type: "material" }, null],
		},
		{ id: "c", title: "Lunch", endTime: "12:30", source: "routine" },
		{
			id: "d",
			title: "Skipped art",
			status: "skipped",
			resources: [{ label: "Paint", type: "material" }],
		},
	];

	it("merges materials across activities and ignores skipped ones", () => {
		expect(materialsFor(items)).toEqual([
			{ label: "Glue stick", for: ["Collage", "Planting"] },
		]);
	});

	it("asks about finished, non-routine activities without feedback", () => {
		expect(needsFeedback(items, new Set(), "12:00").map((i) => i.id)).toEqual([
			"a",
		]);
		expect(
			needsFeedback(items, new Set(["a"]), "18:00").map((i) => i.id),
		).toEqual(["b"]);
	});

	it("formats lists", () => {
		expect(listPhrase(["a"])).toBe("a");
		expect(listPhrase(["a", "b", "c"])).toBe("a, b and c");
	});
});
