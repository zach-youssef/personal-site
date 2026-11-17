// Splits ZGAL source into tokens for the page's listing. ZGAL is an S-expression language, so the
// tokenizer needs no list of its forms: the symbol after an opening bracket is the head of a form or
// a call, whatever its name.

export type TokenKind =
	| 'comment'  // ; to the end of the line
	| 'string'   // "…", with \ escapes
	| 'number'   // 1, -0.5, 6.2831853, 1e-3, 1/60
	| 'boolean'  // #t, #f, #true, #false
	| 'keyword'  // #:frames
	| 'head'     // the symbol after ( or [
	| 'bracket'  // ( ) [ ] { }
	| 'field'    // .x in p.position.x, and an accessor called on its own: (.rgb c)
	| 'text';    // whitespace and every other symbol

export interface Token {
	kind: TokenKind,
	text: string,
}

// One token per match, tried in order: a comment (up to a \n or \r\n), a string (an unterminated one
// runs to the end, a trailing \ included), a bracket, whitespace, or an atom (anything up to the next
// delimiter)
const TOKEN = /;[^\r\n]*|"(?:[^"\\]|\\[^])*\\?"?|[()[\]{}]|\s+|[^\s()[\]{}";]+/g;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:\/\d+)?$/i;
const BOOLEAN = /^#(?:t|f|true|false)$/;
// A symbol followed by its fields: p.position.x
const FIELDS = /^([^.]+)((?:\.[^.]+)+)$/;

// The tokens, whose texts joined together are the source
export function tokenizeZgal(source: string): Token[] {
	const tokens: Token[] = [];
	// Whether the last token that wasn't whitespace or a comment opened a form
	let afterOpen = false;
	for (const [text] of source.matchAll(TOKEN)) {
		const first = text[0];
		if (first === ';') {
			tokens.push({ kind: 'comment', text });
			continue;
		}
		if (/\s/.test(first)) {
			tokens.push({ kind: 'text', text });
			continue;
		}
		const opens = afterOpen;
		afterOpen = first === '(' || first === '[';
		if (first === '"') {
			tokens.push({ kind: 'string', text });
		} else if ('()[]{}'.includes(first)) {
			tokens.push({ kind: 'bracket', text });
		} else if (NUMBER.test(text)) {
			tokens.push({ kind: 'number', text });
		} else if (BOOLEAN.test(text)) {
			tokens.push({ kind: 'boolean', text });
		} else if (text.startsWith('#:')) {
			tokens.push({ kind: 'keyword', text });
		} else if (text.length > 1 && text[0] === '.') {
			// An accessor, even at the head of a form, reads as the field it is in p.rgb
			tokens.push({ kind: 'field', text });
		} else {
			const fields = FIELDS.exec(text);
			tokens.push({ kind: opens ? 'head' : 'text', text: fields ? fields[1] : text });
			for (const field of fields?.[2].match(/\.[^.]+/g) ?? []) {
				tokens.push({ kind: 'field', text: field });
			}
		}
	}
	return tokens;
}
