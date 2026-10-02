import { client, unwrap } from "./data-client";

// Speaks text aloud: Amazon Polly's neural voice through the backend (much
// better than built-in voices, especially on a Raspberry Pi), falling back to
// the browser's own speech if that fails. Only one thing speaks at a time.

let current: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
	current?.pause();
	current = null;
	if (typeof window !== "undefined" && "speechSynthesis" in window) {
		window.speechSynthesis.cancel();
	}
}

function browserSpeak(text: string): Promise<void> {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const utterance = new SpeechSynthesisUtterance(
			text.replace(/[*_#`>]/g, ""),
		);
		utterance.rate = 0.95;
		utterance.pitch = 1.05;
		utterance.onend = () => resolve();
		utterance.onerror = () => resolve();
		window.speechSynthesis.speak(utterance);
	});
}

// Resolves when the speech has finished (or failed).
export async function speakText(text: string): Promise<void> {
	stopSpeaking();
	if (!text.trim()) return;
	try {
		if (typeof client.queries.speak !== "function") throw new Error("no speak");
		const audio64 = unwrap(await client.queries.speak({ text }));
		if (!audio64) return;
		const audio = new Audio(`data:audio/mpeg;base64,${audio64}`);
		current = audio;
		await new Promise<void>((resolve) => {
			audio.onended = () => resolve();
			audio.onerror = () => resolve();
			audio.play().catch(() => resolve());
		});
		if (current === audio) current = null;
	} catch {
		await browserSpeak(text);
	}
}
