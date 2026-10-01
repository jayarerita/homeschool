// A model client for Bedrock's OpenAI-compatible Chat Completions endpoint
// (bedrock-mantle /openai/v1), for models that aren't served through the
// Claude Messages API, e.g. Google's Gemma (google.gemma-4-31b).
//
// The tutor's conversation stays in Claude's Messages format; it is converted
// to Chat Completions messages for each request, and the reply converted back.
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";
import OpenAI from "openai";
import type {
	ChatCompletionContentPart,
	ChatCompletionMessageParam,
	ChatCompletionTool,
} from "openai/resources/chat/completions";
import type {
	ContentBlockParam,
	MessageParam,
	ModelClient,
	ModelStep,
	StepRequest,
	StopReason,
	ToolDefinition,
} from "./model";

// Signs each request with the Lambda role's credentials (SigV4), the same way
// the Bedrock Claude client does, so no Bedrock API key is needed.
function signedFetch(region: string): typeof fetch {
	const signer = new SignatureV4({
		service: "bedrock-mantle",
		region,
		credentials: defaultProvider(),
		sha256: Sha256,
	});
	return async (input, init) => {
		const url = new URL(
			typeof input === "string" || input instanceof URL ? input : input.url,
		);
		const headers: Record<string, string> = {};
		new Headers(init?.headers).forEach((value, key) => {
			// The SDK sends a placeholder bearer token; SigV4 replaces it.
			if (key !== "authorization") headers[key] = value;
		});
		headers.host = url.host;
		const signed = await signer.sign({
			method: init?.method ?? "GET",
			protocol: url.protocol,
			hostname: url.hostname,
			path: url.pathname,
			query: Object.fromEntries(url.searchParams),
			headers,
			body: init?.body ?? undefined,
		});
		return fetch(url, { ...init, headers: signed.headers });
	};
}

function textOf(blocks: readonly ContentBlockParam[]): string {
	return blocks
		.flatMap((b) => (b.type === "text" ? [b.text] : []))
		.join("\n\n");
}

// Content of a tool result, as text. Chat Completions tool messages are text
// only, so files (PDFs, images) are described rather than passed.
function toolResultText(block: ContentBlockParam): string {
	if (block.type !== "tool_result") return "";
	const content = block.content;
	const text =
		typeof content === "string"
			? content
			: (content ?? [])
					.map((part) =>
						part.type === "text"
							? part.text
							: `[${part.type} content is not available to this model]`,
					)
					.join("\n");
	return block.is_error ? `Error: ${text}` : text;
}

function userParts(
	blocks: readonly ContentBlockParam[],
): ChatCompletionContentPart[] {
	return blocks.flatMap((b): ChatCompletionContentPart[] => {
		if (b.type === "text") return [{ type: "text", text: b.text }];
		if (b.type === "image" && b.source.type === "base64") {
			return [
				{
					type: "image_url",
					image_url: {
						url: `data:${b.source.media_type};base64,${b.source.data}`,
					},
				},
			];
		}
		return [];
	});
}

// Claude-format conversation → Chat Completions messages. Mid-conversation
// operator ("system") messages are folded into the user turn they follow,
// since many chat templates only accept a leading system message.
export function toChatMessages(
	system: string,
	messages: readonly MessageParam[],
): ChatCompletionMessageParam[] {
	const out: ChatCompletionMessageParam[] = [
		{ role: "system", content: system },
	];
	const appendUserText = (text: string) => {
		const last = out.at(-1);
		if (last?.role === "user" && typeof last.content === "string") {
			last.content = `${last.content}\n\n${text}`;
		} else if (last?.role === "user" && Array.isArray(last.content)) {
			last.content = [...last.content, { type: "text", text }];
		} else {
			out.push({ role: "user", content: text });
		}
	};

	for (const message of messages) {
		const blocks: ContentBlockParam[] =
			typeof message.content === "string"
				? [{ type: "text", text: message.content }]
				: message.content;

		if (message.role === "system") {
			appendUserText(
				`[Context from the app, not typed by the parent]\n${textOf(blocks)}`,
			);
		} else if (message.role === "assistant") {
			const toolCalls = blocks.flatMap((b) =>
				b.type === "tool_use"
					? [
							{
								id: b.id,
								type: "function" as const,
								function: {
									name: b.name,
									arguments: JSON.stringify(b.input ?? {}),
								},
							},
						]
					: [],
			);
			out.push({
				role: "assistant",
				content: textOf(blocks) || null,
				...(toolCalls.length > 0 && { tool_calls: toolCalls }),
			});
		} else {
			for (const b of blocks) {
				if (b.type === "tool_result") {
					out.push({
						role: "tool",
						tool_call_id: b.tool_use_id,
						content: toolResultText(b),
					});
				}
			}
			const parts = userParts(blocks);
			if (parts.length === 0) continue;
			if (parts.every((p) => p.type === "text")) {
				appendUserText(
					parts.map((p) => (p.type === "text" ? p.text : "")).join("\n\n"),
				);
			} else {
				out.push({ role: "user", content: parts });
			}
		}
	}
	return out;
}

export function toChatTools(
	tools: readonly ToolDefinition[],
): ChatCompletionTool[] {
	return tools.map((t) => ({
		type: "function",
		function: {
			name: t.name,
			description: t.description,
			parameters: t.input_schema as Record<string, unknown>,
		},
	}));
}

// Chat Completions reply → Claude-format assistant content.
export function fromChatReply(
	message: { content?: string | null; tool_calls?: readonly unknown[] | null },
	finishReason: string | null | undefined,
): ModelStep {
	const content: ContentBlockParam[] = [];
	if (message.content?.trim())
		content.push({ type: "text", text: message.content });
	for (const call of message.tool_calls ?? []) {
		const c = call as {
			id: string;
			type: string;
			function?: { name: string; arguments: string };
		};
		if (c.type !== "function" || !c.function) continue;
		let input: unknown = {};
		try {
			input = JSON.parse(c.function.arguments || "{}");
		} catch {
			// Left empty: the tool's schema check reports the problem to the model.
		}
		content.push({ type: "tool_use", id: c.id, name: c.function.name, input });
	}
	const stopReason: StopReason = content.some((b) => b.type === "tool_use")
		? "tool_use"
		: finishReason === "length"
			? "max_tokens"
			: finishReason === "content_filter"
				? "refusal"
				: "end_turn";
	return { stopReason, content };
}

export class OpenAICompatibleModel implements ModelClient {
	#client: OpenAI;
	#model: string;

	// baseURL is overridable for tests.
	constructor(model: string, baseURL?: string) {
		const region = process.env.AWS_REGION ?? "us-east-1";
		this.#model = model;
		this.#client = new OpenAI({
			apiKey: "signed-with-sigv4",
			baseURL: baseURL ?? `https://bedrock-mantle.${region}.api.aws/openai/v1`,
			fetch: signedFetch(region),
		});
	}

	async step(request: StepRequest): Promise<ModelStep> {
		const stream = this.#client.chat.completions.stream({
			model: this.#model,
			messages: toChatMessages(request.system, request.messages),
			tools: toChatTools(request.tools),
			// Gemma on Bedrock handles one tool call per turn.
			parallel_tool_calls: false,
			max_tokens: 16000,
			reasoning_effort: "medium",
		});
		if (request.onText) {
			const onText = request.onText;
			stream.on("content", (delta) => onText(delta));
		}
		const completion = await stream.finalChatCompletion();
		const choice = completion.choices[0];
		return fromChatReply(choice?.message ?? {}, choice?.finish_reason);
	}
}
