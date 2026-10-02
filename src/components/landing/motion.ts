import { type RefObject, useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

// True while the element is on screen, so demos only run when someone can
// see them.
export function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
	const ref = useRef<T>(null);
	const [inView, setInView] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el || typeof IntersectionObserver === "undefined") {
			setInView(true);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => setInView(entry.isIntersecting),
			{ threshold: 0.3 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	return [ref, inView];
}

// Steps through a demo script: step i lasts durations[i] ms, then it loops
// (`cycle` counts the loops, to restart CSS animations). With reduced motion
// it rests on the last step.
export function useScript(durations: readonly number[], running: boolean) {
	const last = durations.length - 1;
	const [state, setState] = useState({ step: 0, cycle: 0 });
	const [reduced, setReduced] = useState(false);
	useEffect(() => setReduced(prefersReducedMotion()), []);
	useEffect(() => {
		if (!running || reduced) return;
		const timer = setTimeout(
			() =>
				setState(({ step, cycle }) =>
					step >= last
						? { step: 0, cycle: cycle + 1 }
						: { step: step + 1, cycle },
				),
			durations[state.step],
		);
		return () => clearTimeout(timer);
	}, [state.step, running, reduced, durations, last]);
	return reduced ? { step: last, cycle: 0 } : state;
}

// Reveals text a few characters at a time once `start` is true.
export function useTypewriter(text: string, start: boolean, speed = 22) {
	const [shown, setShown] = useState(0);
	useEffect(() => {
		setShown(0);
		if (!start) return;
		if (prefersReducedMotion()) {
			setShown(text.length);
			return;
		}
		const timer = setInterval(
			() =>
				setShown((n) => {
					if (n >= text.length) {
						clearInterval(timer);
						return n;
					}
					return n + 2;
				}),
			speed,
		);
		return () => clearInterval(timer);
	}, [text, start, speed]);
	return text.slice(0, shown);
}
