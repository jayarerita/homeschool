import { describe, expect, it } from "vitest";
import { sanitizeWorksheetHtml, WORKSHEET_CSP } from "./worksheet";

describe("sanitizeWorksheetHtml", () => {
	it("wraps fragments in a full document with the CSP first in <head>", () => {
		const out = sanitizeWorksheetHtml("<h1>Count the apples</h1>");
		expect(out).toMatch(
			/^<!doctype html><html><head><meta http-equiv="Content-Security-Policy"/,
		);
		expect(out).toContain(WORKSHEET_CSP);
		expect(out).toContain("<h1>Count the apples</h1>");
	});

	it("adds the CSP to existing documents, with or without <head>", () => {
		expect(
			sanitizeWorksheetHtml(
				"<html><head><title>x</title></head><body>hi</body></html>",
			),
		).toMatch(/<head><meta http-equiv="Content-Security-Policy"[^>]*><title>/);
		expect(
			sanitizeWorksheetHtml("<html lang='en'><body>hi</body></html>"),
		).toMatch(
			/<html lang='en'><head><meta http-equiv="Content-Security-Policy"/,
		);
	});

	it("removes scripts, event handlers and javascript: URLs", () => {
		const out = sanitizeWorksheetHtml(
			`<html><head><meta http-equiv="Content-Security-Policy" content="default-src *"><script>alert(1)</script></head>
			<body onload="steal()"><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>
			<svg><circle onclick='go()' r="5"/></svg><iframe src="https://evil"></iframe><script src="x.js"></body></html>`,
		);
		expect(out).not.toMatch(
			/<script|alert\(1\)|onload|onerror|onclick|javascript:|<iframe|default-src \*/i,
		);
		expect(out).toContain('<circle r="5"/>');
		expect(out).toContain('<a href="#">x</a>');
	});

	it("keeps ordinary styling and inline SVG", () => {
		const html = `<style>.box{border:2px dashed #999}</style><div class="box"><svg viewBox="0 0 10 10"><path d="M1 1L9 9"/></svg></div>`;
		expect(sanitizeWorksheetHtml(html)).toContain(html);
	});
});
