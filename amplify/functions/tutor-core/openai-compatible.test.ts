import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MessageParam } from "./model";
import {
	fromChatReply,
	OpenAICompatibleModel,
	toChatMessages,
	toChatTools,
} from "./openai-compatible";

describe("toChatMessages", () => {
	const history: MessageParam[] = [
		{ role: "user", content: [{ type: "text", text: "Add a game at 9" }] },
		{ role: "system", content: "Today is Thursday." },
		{
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "", signature: "sig" },
				{ type: "text", text: "Adding it." },
				{
					type: "tool_use",
					id: "call_1",
					name: "add_agenda_item",
					input: { title: "Game" },
				},
			],
		},
		{
			role: "user",
			content: [
				{ type: "tool_result", tool_use_id: "call_1", content: '{"id":"a1"}' },
			],
		},
		{
			role: "user",
			content: [
				{
					type: "tool_result",
					tool_use_id: "call_2",
					is_error: true,
					content: [
						{ type: "text", text: "Here is the file" },
						{
							type: "document",
							source: {
								type: "base64",
								media_type: "application/pdf",
								data: "AA==",
							},
						},
					],
				},
			],
		},
	];
	const out = toChatMessages("Be kind.", history);

	it("starts with the system prompt and folds app context into the user turn", () => {
		expect(out[0]).toEqual({ role: "system", content: "Be kind." });
		expect(out[1].role).toBe("user");
		expect(out[1].content).toContain("Add a game at 9");
		expect(out[1].content).toContain("Today is Thursday.");
		expect(out.filter((m) => m.role === "system")).toHaveLength(1);
	});

	it("converts tool calls and drops thinking blocks", () => {
		expect(out[2]).toEqual({
			role: "assistant",
			content: "Adding it.",
			tool_calls: [
				{
					id: "call_1",
					type: "function",
					function: { name: "add_agenda_item", arguments: '{"title":"Game"}' },
				},
			],
		});
	});

	it("turns tool results into tool messages, describing files as text", () => {
		expect(out[3]).toEqual({
			role: "tool",
			tool_call_id: "call_1",
			content: '{"id":"a1"}',
		});
		expect(out[4]).toEqual({
			role: "tool",
			tool_call_id: "call_2",
			content:
				"Error: Here is the file\n[document content is not available to this model]",
		});
	});
});

describe("fromChatReply", () => {
	it("maps tool calls to tool_use blocks", () => {
		const step = fromChatReply(
			{
				content: "",
				tool_calls: [
					{
						id: "c1",
						type: "function",
						function: {
							name: "get_agenda",
							arguments: '{"start_date":"2026-10-01"}',
						},
					},
				],
			},
			"tool_calls",
		);
		expect(step).toEqual({
			stopReason: "tool_use",
			content: [
				{
					type: "tool_use",
					id: "c1",
					name: "get_agenda",
					input: { start_date: "2026-10-01" },
				},
			],
		});
	});

	it("maps finish reasons and survives bad JSON", () => {
		expect(fromChatReply({ content: "Hi" }, "stop")).toEqual({
			stopReason: "end_turn",
			content: [{ type: "text", text: "Hi" }],
		});
		expect(fromChatReply({ content: "Hi" }, "length").stopReason).toBe(
			"max_tokens",
		);
		expect(
			fromChatReply(
				{
					tool_calls: [
						{
							id: "c",
							type: "function",
							function: { name: "x", arguments: "{oops" },
						},
					],
				},
				"tool_calls",
			).content,
		).toEqual([{ type: "tool_use", id: "c", name: "x", input: {} }]);
	});

	it("converts tool definitions", () => {
		expect(
			toChatTools([
				{
					name: "t",
					description: "d",
					input_schema: { type: "object", properties: {} },
				},
			]),
		).toEqual([
			{
				type: "function",
				function: {
					name: "t",
					description: "d",
					parameters: { type: "object", properties: {} },
				},
			},
		]);
	});
});

describe("OpenAICompatibleModel (against a local fake endpoint)", () => {
	const received: {
		headers: IncomingMessage["headers"];
		body: Record<string, unknown>;
	}[] = [];
	let baseURL = "";
	const server = createServer(async (req, res) => {
		let raw = "";
		for await (const chunk of req) raw += chunk;
		received.push({ headers: req.headers, body: JSON.parse(raw) });
		const base = {
			id: "x",
			object: "chat.completion.chunk",
			created: 1,
			model: "google.gemma-4-31b",
		};
		const chunks = [
			{
				...base,
				choices: [
					{
						index: 0,
						delta: { role: "assistant", content: "Let me check. " },
						finish_reason: null,
					},
				],
			},
			{
				...base,
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{
									index: 0,
									id: "call_9",
									type: "function",
									function: { name: "get_agenda", arguments: '{"start_' },
								},
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				...base,
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{ index: 0, function: { arguments: 'date":"2026-10-01"}' } },
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				...base,
				choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
			},
		];
		res.writeHead(200, { "content-type": "text/event-stream" });
		for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
		res.end("data: [DONE]\n\n");
	});

	beforeAll(async () => {
		process.env.AWS_ACCESS_KEY_ID = "AKIDEXAMPLE";
		process.env.AWS_SECRET_ACCESS_KEY = "secret";
		process.env.AWS_SESSION_TOKEN = "token";
		process.env.AWS_REGION = "us-east-1";
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/openai/v1`;
	});
	afterAll(() => server.close());

	it("signs the request, streams text and returns the tool call", async () => {
		const model = new OpenAICompatibleModel("google.gemma-4-31b", baseURL);
		const deltas: string[] = [];
		const step = await model.step({
			system: "Be kind.",
			tools: [
				{
					name: "get_agenda",
					input_schema: { type: "object", properties: {} },
				},
			],
			messages: [{ role: "user", content: "What's on today?" }],
			onText: (d) => deltas.push(d),
		});

		const [{ headers, body }] = received;
		expect(headers.authorization).toMatch(
			/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/bedrock-mantle\/aws4_request/,
		);
		expect(headers["x-amz-security-token"]).toBe("token");
		expect(body).toMatchObject({
			model: "google.gemma-4-31b",
			stream: true,
			parallel_tool_calls: false,
			tools: [{ type: "function", function: { name: "get_agenda" } }],
		});
		expect(deltas.join("")).toBe("Let me check. ");
		expect(step).toEqual({
			stopReason: "tool_use",
			content: [
				{ type: "text", text: "Let me check. " },
				{
					type: "tool_use",
					id: "call_9",
					name: "get_agenda",
					input: { start_date: "2026-10-01" },
				},
			],
		});
	});
});
