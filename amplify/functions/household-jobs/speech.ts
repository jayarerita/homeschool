import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

// Polly's limit is 3000 billed characters per request; stay under it.
const MAX_CHARS = 2800;

// Plain spoken text: no markdown symbols, links or emoji, and cut at a
// sentence boundary if it's long.
export function speechText(text: string): string {
	let out = text
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links/images
		.replace(/https?:\/\/\S+/g, "") // bare URLs
		.replace(/[*_#`>~|]/g, "") // markdown symbols
		.replace(/\p{Extended_Pictographic}️?/gu, "") // emoji
		.replace(/^\s*[-•]\s+/gm, "") // list bullets
		.replace(/\s+/g, " ")
		.trim();
	if (out.length > MAX_CHARS) {
		const cut = out.slice(0, MAX_CHARS);
		const end = Math.max(
			cut.lastIndexOf(". "),
			cut.lastIndexOf("? "),
			cut.lastIndexOf("! "),
		);
		out = end > MAX_CHARS / 2 ? cut.slice(0, end + 1) : cut;
	}
	return out;
}

const polly = new PollyClient();

// Spoken audio (MP3, base64) in a natural neural voice.
export async function speak(text: string): Promise<string | null> {
	const Text = speechText(text);
	if (!Text) return null;
	const { AudioStream } = await polly.send(
		new SynthesizeSpeechCommand({
			Text,
			OutputFormat: "mp3",
			VoiceId: "Joanna",
			Engine: "neural",
		}),
	);
	const bytes = await AudioStream?.transformToByteArray();
	return bytes ? Buffer.from(bytes).toString("base64") : null;
}
