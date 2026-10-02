import { useCallback, useEffect, useRef, useState } from "react";

// Read aloud and talk back with the browser's built-in speech: free, no
// backend. Speech recognition is best in Chrome; where a browser lacks it the
// microphone is simply hidden.

const READ_ALOUD_KEY = "lesson-read-aloud";

export function useReadAloud() {
	const supported =
		typeof window !== "undefined" && "speechSynthesis" in window;
	const [enabled, setEnabledState] = useState(true);

	useEffect(() => {
		try {
			setEnabledState(localStorage.getItem(READ_ALOUD_KEY) !== "off");
		} catch {}
		return () => {
			if (supported) window.speechSynthesis.cancel();
		};
	}, [supported]);

	const setEnabled = useCallback(
		(on: boolean) => {
			setEnabledState(on);
			try {
				localStorage.setItem(READ_ALOUD_KEY, on ? "on" : "off");
			} catch {}
			if (!on && supported) window.speechSynthesis.cancel();
		},
		[supported],
	);

	const speak = useCallback(
		(text: string) => {
			if (!supported || !text.trim()) return;
			window.speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(
				// Markdown symbols read badly aloud.
				text.replace(/[*_#`>]/g, ""),
			);
			utterance.rate = 0.95;
			utterance.pitch = 1.05;
			window.speechSynthesis.speak(utterance);
		},
		[supported],
	);

	return { supported, enabled, setEnabled, speak };
}

// Minimal typing for the (still prefixed in some browsers) Web Speech API.
type Recognition = {
	lang: string;
	interimResults: boolean;
	maxAlternatives: number;
	start(): void;
	stop(): void;
	onresult:
		| ((event: {
				results: ArrayLike<ArrayLike<{ transcript: string }>>;
		  }) => void)
		| null;
	onend: (() => void) | null;
	onerror: ((event: { error: string }) => void) | null;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
	if (typeof window === "undefined") return null;
	const w = window as unknown as {
		SpeechRecognition?: RecognitionConstructor;
		webkitSpeechRecognition?: RecognitionConstructor;
	};
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(onHeard: (text: string) => void) {
	const [supported, setSupported] = useState(false);
	const [listening, setListening] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const recognition = useRef<Recognition | null>(null);
	const onHeardRef = useRef(onHeard);
	onHeardRef.current = onHeard;

	useEffect(() => {
		setSupported(recognitionConstructor() !== null);
		return () => recognition.current?.stop();
	}, []);

	const start = useCallback(() => {
		const Ctor = recognitionConstructor();
		if (!Ctor) return;
		const r = new Ctor();
		r.lang = navigator.language || "en-US";
		r.interimResults = false;
		r.maxAlternatives = 1;
		r.onresult = (event) => {
			const text = event.results[0]?.[0]?.transcript?.trim();
			if (text) onHeardRef.current(text);
		};
		r.onerror = (event) => {
			setError(
				event.error === "not-allowed"
					? "The microphone is blocked for this site."
					: event.error === "no-speech"
						? "I didn't hear anything. Try again?"
						: "The microphone didn't work.",
			);
		};
		r.onend = () => setListening(false);
		recognition.current = r;
		setError(null);
		setListening(true);
		r.start();
	}, []);

	const stop = useCallback(() => recognition.current?.stop(), []);

	return { supported, listening, error, start, stop };
}
