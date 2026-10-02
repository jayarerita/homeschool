// Printable worksheets written by the tutor are model-generated HTML. They're
// shown in a sandboxed iframe with scripts disabled (src/routes/_authed/
// worksheet.tsx); this is a second layer: scripts, inline event handlers and
// javascript: URLs are removed, and a Content-Security-Policy blocks every
// external load (only inline styles, data: images and inline SVG work).

export const WORKSHEET_CSP =
	"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${WORKSHEET_CSP}">`;

export function sanitizeWorksheetHtml(html: string): string {
	let out = html
		// <script>…</script> and stray <script …> tags
		.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
		.replace(/<\/?script\b[^>]*>/gi, "")
		// Other active or external-loading elements
		.replace(
			/<\/?(iframe|object|embed|link|base|form|input|button)\b[^>]*>/gi,
			"",
		)
		// on…= event handler attributes, quoted or not
		.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		// javascript: URLs
		.replace(
			/(href|src|xlink:href)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi,
			'$1="#"',
		)
		// Existing CSP metas (ours goes first)
		.replace(
			/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
			"",
		);

	if (!/<html\b/i.test(out)) {
		out = `<!doctype html><html><head><meta charset="utf-8"></head><body>${out}</body></html>`;
	} else if (!/<head\b/i.test(out)) {
		out = out.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head></head>`);
	}
	return out.replace(/<head\b[^>]*>/i, (tag) => `${tag}${CSP_META}`);
}
