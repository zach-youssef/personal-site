import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Token, tokenizeZgal } from './highlightZgal';

// Every example in the pinned ZGAL checkout, which includes every program ./build-zgal copies for
// the page
const EXAMPLES = resolve(__dirname, '../../../../external/zgal/examples');
const examples = readdirSync(EXAMPLES, { withFileTypes: true })
	.filter(entry => entry.isDirectory() && existsSync(resolve(EXAMPLES, entry.name, `${entry.name}.zgal`)))
	.map(entry => entry.name);

// The tokens that aren't plain text, as [kind, text]
const marked = (source: string) => tokenizeZgal(source)
	.filter(token => token.kind !== 'text')
	.map(({ kind, text }: Token) => [kind, text]);

describe('tokenizeZgal', () => {
	it('finds the examples the page shows', () => {
		expect(examples).toEqual(expect.arrayContaining(['particles', 'scene']));
	});

	for (const name of examples) {
		it(`rebuilds ${name}.zgal exactly from its tokens`, () => {
			const source = readFileSync(resolve(EXAMPLES, name, `${name}.zgal`), 'utf8');
			const tokens = tokenizeZgal(source);
			expect(tokens.map(token => token.text).join('')).toBe(source);
			expect(tokens.every(token => token.text.length > 0)).toBe(true);
		});
	}

	it('marks comments to the end of the line', () => {
		expect(tokenizeZgal(';; a (comment) "x"\n(f) ; trailing')).toEqual([
			{ kind: 'comment', text: ';; a (comment) "x"' },
			{ kind: 'text', text: '\n' },
			{ kind: 'bracket', text: '(' },
			{ kind: 'head', text: 'f' },
			{ kind: 'bracket', text: ')' },
			{ kind: 'text', text: ' ' },
			{ kind: 'comment', text: '; trailing' },
		]);
	});

	it('ends comments before a CRLF line ending', () => {
		expect(tokenizeZgal('; c\r\n(f)').slice(0, 2)).toEqual([
			{ kind: 'comment', text: '; c' },
			{ kind: 'text', text: '\r\n' },
		]);
	});

	it('marks strings, with escapes, comment characters and keywords inside them', () => {
		expect(marked('(load "a \\"b\\" ; #:c" x)')).toEqual([
			['bracket', '('], ['head', 'load'], ['string', '"a \\"b\\" ; #:c"'], ['bracket', ')'],
		]);
	});

	it('runs an unterminated string to the end', () => {
		expect(marked('(f "abc\n(g)')).toEqual([['bracket', '('], ['head', 'f'], ['string', '"abc\n(g)']]);
	});

	it('runs a string cut off by a backslash to the end, the backslash included', () => {
		expect(marked('(f "ab\\')).toEqual([['bracket', '('], ['head', 'f'], ['string', '"ab\\']]);
	});

	it('marks integers, decimals, exponents and rationals as numbers', () => {
		expect(marked('(f 1 -0.5 6.2831853 .5 1e-3 1/60)').filter(([kind]) => kind === 'number'))
			.toEqual([['number', '1'], ['number', '-0.5'], ['number', '6.2831853'], ['number', '.5'],
				['number', '1e-3'], ['number', '1/60']]);
	});

	it("doesn't mark symbols that start with a digit or a sign as numbers", () => {
		expect(marked('(f - 2d x1 -x)')).toEqual([['bracket', '('], ['head', 'f'], ['bracket', ')']]);
	});

	it('marks booleans', () => {
		expect(marked('(f #t #f #true #false)').filter(([kind]) => kind === 'boolean'))
			.toEqual([['boolean', '#t'], ['boolean', '#f'], ['boolean', '#true'], ['boolean', '#false']]);
	});

	it('marks keywords', () => {
		expect(marked('(app #:frames 3 #:when-pressed x)')).toEqual([
			['bracket', '('], ['head', 'app'], ['keyword', '#:frames'], ['number', '3'],
			['keyword', '#:when-pressed'], ['bracket', ')'],
		]);
	});

	it('marks the head of each form, after ( or [, past whitespace and comments', () => {
		expect(marked('(define (spawn [index : uint]) (let* ([r (f x)]) (\n  ; c\n  g)))')
			.filter(([kind]) => kind === 'head').map(([, text]) => text))
			.toEqual(['define', 'spawn', 'index', 'let*', 'r', 'f', 'g']);
	});

	it("doesn't mark a literal at the head of a form as a head", () => {
		expect(marked('(1 2) ("s") (#t)')).toEqual([
			['bracket', '('], ['number', '1'], ['number', '2'], ['bracket', ')'],
			['bracket', '('], ['string', '"s"'], ['bracket', ')'],
			['bracket', '('], ['boolean', '#t'], ['bracket', ')'],
		]);
	});

	it('marks every kind of bracket', () => {
		expect(marked('([{}])').map(([kind]) => kind)).toEqual(Array(6).fill('bracket'));
	});

	it('splits field accesses off their symbol, at the head of a form too', () => {
		expect(tokenizeZgal('(f p.position.x)')).toEqual([
			{ kind: 'bracket', text: '(' },
			{ kind: 'head', text: 'f' },
			{ kind: 'text', text: ' ' },
			{ kind: 'text', text: 'p' },
			{ kind: 'field', text: '.position' },
			{ kind: 'field', text: '.x' },
			{ kind: 'bracket', text: ')' },
		]);
		expect(marked('(params.reset)')).toEqual([
			['bracket', '('], ['head', 'params'], ['field', '.reset'], ['bracket', ')'],
		]);
	});

	it('marks an accessor called on its own as a field, not a head', () => {
		expect(marked('(.rgb (sample t uv)) (f .x)')).toEqual([
			['bracket', '('], ['field', '.rgb'], ['bracket', '('], ['head', 'sample'], ['bracket', ')'],
			['bracket', ')'], ['bracket', '('], ['head', 'f'], ['field', '.x'], ['bracket', ')'],
		]);
	});
});
