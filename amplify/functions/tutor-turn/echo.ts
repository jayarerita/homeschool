// Content blocks from a response, prepared to be sent back in later requests.
//
// Normally the assistant's content is echoed back unchanged (thinking blocks
// included - they are bound to this conversation and must not be edited).
// The exception is a refusal fallback: when one model declined mid-output and
// another continued, the blocks before the final `fallback` marker that only
// make sense to the declining model (thinking, redacted thinking, tool calls,
// unpaired server tool calls) are dropped. Text before the boundary and
// everything after it are kept; the `fallback` markers themselves are audit
// markers and are dropped.

type Block = { type: string; id?: string; tool_use_id?: string };

const DROPPED_BEFORE_FALLBACK = new Set([
	"thinking",
	"redacted_thinking",
	"tool_use",
]);

export function echoableContent<T extends Block>(content: readonly T[]): T[] {
	const boundary = content.map((b) => b.type).lastIndexOf("fallback");
	if (boundary === -1) return [...content];

	const before = content.slice(0, boundary);
	const pairedServerCalls = new Set(
		before
			.filter((b) => b.type.endsWith("_tool_result") && b.tool_use_id)
			.map((b) => b.tool_use_id),
	);
	const kept = before.filter((b) => {
		if (b.type === "fallback" || DROPPED_BEFORE_FALLBACK.has(b.type)) {
			return false;
		}
		if (b.type === "server_tool_use") return pairedServerCalls.has(b.id);
		return true;
	});
	return [...kept, ...content.slice(boundary + 1)];
}
