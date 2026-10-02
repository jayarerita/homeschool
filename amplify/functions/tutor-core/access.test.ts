import { describe, expect, it } from "vitest";
import { canUseConversation } from "./access";

describe("canUseConversation", () => {
	it("lets parents use any conversation", () => {
		expect(
			canUseConversation(
				{ username: "p", groups: ["ADMIN", "PARENT"] },
				{ owner: "someone" },
			),
		).toBe(true);
		expect(canUseConversation({ username: "p", groups: ["PARENT"] }, {})).toBe(
			true,
		);
	});

	it("lets other accounts use only their own conversations", () => {
		const device = { username: "dev-1", groups: ["DEVICE"] };
		expect(canUseConversation(device, { owner: "dev-1" })).toBe(true);
		expect(canUseConversation(device, { owner: "sub-123::dev-1" })).toBe(true);
		expect(canUseConversation(device, { owner: "parent-1" })).toBe(false);
		expect(canUseConversation(device, { owner: null })).toBe(false);
	});

	it("refuses unknown callers", () => {
		expect(canUseConversation(undefined, { owner: "dev-1" })).toBe(false);
		expect(canUseConversation({ groups: ["DEVICE"] }, { owner: "dev-1" })).toBe(
			false,
		);
	});
});
