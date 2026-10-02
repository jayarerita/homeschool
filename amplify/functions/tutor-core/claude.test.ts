import { describe, expect, it } from "vitest";
import { foldSystemMessages } from "./claude";

describe("foldSystemMessages", () => {
	it("moves app context into the preceding user turn", () => {
		expect(
			foldSystemMessages([
				{ role: "user", content: [{ type: "text", text: "What's on today?" }] },
				{ role: "system", content: "Today is Friday." },
				{ role: "assistant", content: [{ type: "text", text: "Breakfast." }] },
				{ role: "user", content: "Thanks" },
				{ role: "system", content: [{ type: "text", text: "Still Friday." }] },
			]),
		).toEqual([
			{
				role: "user",
				content: [
					{ type: "text", text: "What's on today?" },
					{
						type: "text",
						text: "[Context from the app, not typed by the parent]\nToday is Friday.",
					},
				],
			},
			{ role: "assistant", content: [{ type: "text", text: "Breakfast." }] },
			{
				role: "user",
				content: [
					{ type: "text", text: "Thanks" },
					{
						type: "text",
						text: "[Context from the app, not typed by the parent]\nStill Friday.",
					},
				],
			},
		]);
	});

	it("leaves conversations without system messages unchanged", () => {
		const messages = [{ role: "user" as const, content: "Hi" }];
		expect(foldSystemMessages(messages)).toEqual(messages);
	});
});
