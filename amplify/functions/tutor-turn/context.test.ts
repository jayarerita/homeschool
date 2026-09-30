import { describe, expect, it } from "vitest";
import {
	addDays,
	ageOn,
	describeDate,
	isValidTimeZone,
	localDateKey,
} from "./context";

describe("household-local dates", () => {
	// 2026-10-01 03:30 UTC is still Sept 30 in Chicago.
	const now = new Date("2026-10-01T03:30:00Z");

	it("uses the household time zone, not the Lambda's UTC", () => {
		expect(localDateKey(now, "America/Chicago")).toBe("2026-09-30");
		expect(localDateKey(now, "UTC")).toBe("2026-10-01");
	});

	it("adds days across month and year ends", () => {
		expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
	});

	it("describes a date without shifting it", () => {
		expect(describeDate("2026-09-30")).toBe("Wednesday, September 30, 2026");
	});

	it("computes age on a date", () => {
		expect(ageOn("2022-10-01", "2026-09-30")).toBe(3);
		expect(ageOn("2022-10-01", "2026-10-01")).toBe(4);
	});

	it("validates time zone names", () => {
		expect(isValidTimeZone("America/New_York")).toBe(true);
		expect(isValidTimeZone("Not/AZone")).toBe(false);
		expect(isValidTimeZone(null)).toBe(false);
	});
});
