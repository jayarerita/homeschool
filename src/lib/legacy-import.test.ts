import { describe, expect, it } from "vitest";
import {
	collectLegacyChildren,
	colorFromIconBg,
	parseClockTime,
	parseLegacyDay,
	parseTimeRange,
	safeUrl,
	toAgendaItems,
} from "./legacy-import";

const DAY = {
	date: "2026-04-06",
	children: [
		{ id: "ada", name: "Ada", emoji: "🌸" },
		{ id: "ben", name: "Ben", emoji: "🚀" },
	],
	items: [
		{
			id: "breakfast",
			title: "Breakfast",
			emoji: "🥞",
			iconBg: "bg-orange-100",
			time: "7:45 AM – 8:15 AM",
		},
		{
			id: "garden",
			title: "Garden",
			iconBg: "bg-green-100",
			time: "12:15 PM - 1:00 PM",
			childIds: ["ben", "unknown"],
			resources: [
				{ id: "r1", label: "Sheet", type: "pdf", url: "#", childIds: ["ben"] },
				{ label: "Song", type: "audio", url: "https://example.com/song" },
			],
		},
	],
};

describe("parseLegacyDay", () => {
	it("accepts a valid day", () => {
		const day = parseLegacyDay(DAY);
		expect(day.date).toBe("2026-04-06");
		expect(day.children).toHaveLength(2);
		expect(day.items).toHaveLength(2);
	});

	it("falls back to the file name for the date", () => {
		expect(parseLegacyDay({ items: [] }, "2026-05-01.json").date).toBe(
			"2026-05-01",
		);
	});

	it("rejects files without a date", () => {
		expect(() => parseLegacyDay({ items: [] }, "notes.json")).toThrow(/date/);
		expect(() => parseLegacyDay([])).toThrow();
	});

	it("drops malformed children and items", () => {
		const day = parseLegacyDay({
			date: "2026-04-06",
			children: [{ id: "x" }, { id: "y", name: "Y" }],
			items: [{ description: "no title" }, { title: "Ok" }],
		});
		expect(day.children.map((c) => c.id)).toEqual(["y"]);
		expect(day.items.map((i) => i.title)).toEqual(["Ok"]);
	});
});

describe("time parsing", () => {
	it.each([
		["7:30 AM", "07:30"],
		["12:05 PM", "12:05"],
		["12:00 AM", "00:00"],
		["3:15 pm", "15:15"],
		["noon", undefined],
	])("parseClockTime(%s)", (input, expected) => {
		expect(parseClockTime(input)).toBe(expected);
	});

	it("parses ranges with en dashes and hyphens", () => {
		expect(parseTimeRange("7:30 AM – 7:45 AM")).toEqual({
			startTime: "07:30",
			endTime: "07:45",
		});
		expect(parseTimeRange("1:00 PM-2:30 PM")).toEqual({
			startTime: "13:00",
			endTime: "14:30",
		});
		expect(parseTimeRange("9:00 AM")).toEqual({
			startTime: "09:00",
			endTime: undefined,
		});
		expect(parseTimeRange(undefined)).toEqual({});
	});
});

describe("field mapping", () => {
	it("maps Tailwind backgrounds to color tokens", () => {
		expect(colorFromIconBg("bg-yellow-100")).toBe("yellow");
		expect(colorFromIconBg("bg-fuchsia-100")).toBeUndefined();
		expect(colorFromIconBg(undefined)).toBeUndefined();
	});

	it("keeps only real URLs", () => {
		expect(safeUrl("#")).toBeUndefined();
		expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
	});
});

describe("collectLegacyChildren", () => {
	it("merges children by name across files", () => {
		const other = parseLegacyDay({
			date: "2026-04-07",
			children: [{ id: "ada-2", name: "ada" }],
			items: [],
		});
		const groups = collectLegacyChildren([parseLegacyDay(DAY), other]);
		expect(groups).toEqual([
			{ name: "Ada", emoji: "🌸", legacyIds: ["ada", "ada-2"] },
			{ name: "Ben", emoji: "🚀", legacyIds: ["ben"] },
		]);
	});
});

describe("toAgendaItems", () => {
	const map = new Map([
		["ada", "child-a"],
		["ben", "child-b"],
	]);
	const items = toAgendaItems(parseLegacyDay(DAY), map);

	it("keeps order with gapped sort keys", () => {
		expect(items.map((i) => [i.title, i.sortOrder])).toEqual([
			["Breakfast", 10],
			["Garden", 20],
		]);
	});

	it("converts times, colors and child ids", () => {
		expect(items[0]).toMatchObject({
			date: "2026-04-06",
			startTime: "07:45",
			endTime: "08:15",
			color: "orange",
			source: "import",
			status: "planned",
		});
		expect(items[0].childIds).toBeUndefined();
		expect(items[1]).toMatchObject({
			startTime: "12:15",
			endTime: "13:00",
			childIds: ["child-b"],
		});
	});

	it("cleans up resources", () => {
		expect(items[1].resources).toEqual([
			{
				id: "r1",
				label: "Sheet",
				type: "pdf",
				url: undefined,
				description: undefined,
				childIds: ["child-b"],
				prompts: undefined,
			},
			{
				id: "garden-r2",
				label: "Song",
				type: "note",
				url: "https://example.com/song",
				description: undefined,
				childIds: undefined,
				prompts: undefined,
			},
		]);
	});
});
