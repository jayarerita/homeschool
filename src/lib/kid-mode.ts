// Kid mode: a parent hands over their device with the app locked to one
// child's simple view. The lock lives in localStorage so a reload doesn't
// escape it; leaving takes a quick parent check.

const KEY = "kid-mode";

export type KidMode = { childId: string };

export function getKidMode(): KidMode | null {
	try {
		const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
		return value && typeof value.childId === "string" ? value : null;
	} catch {
		return null;
	}
}

export function setKidMode(childId: string): void {
	try {
		localStorage.setItem(KEY, JSON.stringify({ childId }));
	} catch {}
}

export function clearKidMode(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {}
}

// Paths a child may visit while kid mode is on.
export function allowedInKidMode(pathname: string, childId: string): boolean {
	return pathname === `/kid/${childId}` || pathname.startsWith("/lesson/");
}

// A question a young child can't answer but a parent can, at a glance.
export function parentCheck(random = Math.random): {
	question: string;
	answer: number;
} {
	const a = 6 + Math.floor(random() * 4);
	const b = 6 + Math.floor(random() * 4);
	return { question: `${a} × ${b}`, answer: a * b };
}

// Activities for one child: those assigned to them, plus ones for everyone.
export function itemsForChild<
	T extends { childIds?: readonly (string | null)[] | null },
>(items: readonly T[], childId: string): T[] {
	return items.filter(
		(item) => !item.childIds?.length || item.childIds.includes(childId),
	);
}
