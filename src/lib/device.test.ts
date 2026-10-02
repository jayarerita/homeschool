import { describe, expect, it } from "vitest";
import { nowAndNext } from "./device";

const items = [
	{ id: "b", startTime: "08:00", endTime: "08:30" },
	{ id: "game", startTime: "09:00", endTime: "09:15" },
	{ id: "walk", startTime: "10:00" },
	{ id: "lunch", startTime: "12:00", endTime: "12:45" },
	{ id: "untimed" },
	{ id: "skipped", startTime: "09:05", status: "skipped" },
];
const ids = (r: { now?: { id: string }; next?: { id: string } }) => [
	r.now?.id,
	r.next?.id,
];

describe("nowAndNext", () => {
	it("finds the current and upcoming activity", () => {
		expect(ids(nowAndNext(items, "08:10"))).toEqual(["b", "game"]);
		expect(ids(nowAndNext(items, "09:05"))).toEqual(["game", "walk"]);
	});

	it("has nothing now between activities", () => {
		expect(ids(nowAndNext(items, "08:45"))).toEqual([undefined, "game"]);
	});

	it("lets an open-ended activity run until the next one", () => {
		expect(ids(nowAndNext(items, "11:30"))).toEqual(["walk", "lunch"]);
		expect(ids(nowAndNext(items, "12:50"))).toEqual([undefined, undefined]);
	});

	it("handles before the day starts", () => {
		expect(ids(nowAndNext(items, "06:00"))).toEqual([undefined, "b"]);
	});
});

describe("nowAndNext at the end of the day", () => {
	it("gives the last open-ended activity an hour", () => {
		const day = [{ id: "story", startTime: "19:00" }];
		expect(ids(nowAndNext(day, "19:30"))).toEqual(["story", undefined]);
		expect(ids(nowAndNext(day, "20:01"))).toEqual([undefined, undefined]);
	});
});
