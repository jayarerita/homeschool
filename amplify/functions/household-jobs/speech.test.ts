import { describe, expect, it } from "vitest";
import { speechText } from "./speech";

describe("speechText", () => {
	it("strips markdown, links, emoji and bullets", () => {
		expect(
			speechText(
				"**Great job!** 🎉 See [the plan](https://x.y/z) at https://a.b\n- one\n- two",
			),
		).toBe("Great job! See the plan at one two");
	});

	it("cuts long text at a sentence end", () => {
		const sentence = "This is a sentence about beans. ";
		const out = speechText(sentence.repeat(200));
		expect(out.length).toBeLessThanOrEqual(2800);
		expect(out.endsWith("beans.")).toBe(true);
	});

	it("returns empty text for nothing speakable", () => {
		expect(speechText("🎉 ** ")).toBe("");
	});
});
