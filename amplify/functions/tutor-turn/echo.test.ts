import { describe, expect, it } from "vitest";
import { echoableContent } from "./echo";

describe("echoableContent", () => {
	it("returns content unchanged when there was no fallback", () => {
		const content = [
			{ type: "thinking" },
			{ type: "text" },
			{ type: "tool_use", id: "t1" },
		];
		expect(echoableContent(content)).toEqual(content);
	});

	it("drops model-internal blocks before the last fallback", () => {
		const content = [
			{ type: "thinking" },
			{ type: "text", id: "partial" },
			{ type: "tool_use", id: "t1" },
			{ type: "fallback" },
			{ type: "thinking", id: "after" },
			{ type: "tool_use", id: "t2" },
		];
		expect(echoableContent(content)).toEqual([
			{ type: "text", id: "partial" },
			{ type: "thinking", id: "after" },
			{ type: "tool_use", id: "t2" },
		]);
	});

	it("keeps paired server tool calls and drops unpaired ones", () => {
		const content = [
			{ type: "server_tool_use", id: "s1" },
			{ type: "web_search_tool_result", tool_use_id: "s1" },
			{ type: "server_tool_use", id: "s2" },
			{ type: "fallback" },
			{ type: "text" },
		];
		expect(echoableContent(content)).toEqual([
			{ type: "server_tool_use", id: "s1" },
			{ type: "web_search_tool_result", tool_use_id: "s1" },
			{ type: "text" },
		]);
	});

	it("uses the last of several fallback boundaries", () => {
		const content = [
			{ type: "text", id: "a" },
			{ type: "fallback" },
			{ type: "thinking" },
			{ type: "text", id: "b" },
			{ type: "fallback" },
			{ type: "text", id: "c" },
		];
		expect(echoableContent(content).map((b) => b.id)).toEqual(["a", "b", "c"]);
	});
});
