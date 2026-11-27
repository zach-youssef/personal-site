import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ProgramSource from './ProgramSource';

// ZGAL's examples, in the submodule
const EXAMPLES_DIR = resolve(__dirname, '../../../../external/zgal/examples');
const EXAMPLES = readdirSync(EXAMPLES_DIR, { withFileTypes: true })
	.filter(entry => entry.isDirectory() && existsSync(resolve(EXAMPLES_DIR, entry.name, `${entry.name}.zgal`)))
	.map(entry => entry.name);

afterEach(() => {
	vi.unstubAllGlobals();
});

const serve = (source: string) => vi.stubGlobal('fetch', vi.fn(async () => new Response(source)));

describe('ProgramSource', () => {
	it('colours the source in spans, keeping its text exactly', async () => {
		const source = ';; Draws\n(app Demo #:frames 1/60 #t "s" p.x)\n';
		serve(source);
		render(<ProgramSource url="/demo.zgal" name="demo.zgal" />);

		const listing = screen.getByLabelText('demo.zgal');
		await waitFor(() => expect(listing.textContent).toBe(source));
		const spans = [...listing.querySelectorAll('span[class^="zgal-"]')].map(span => [span.className, span.textContent]);
		expect(spans).toEqual([
			['zgal-comment', ';; Draws'],
			['zgal-head', 'app'],
			['zgal-keyword', '#:frames'],
			['zgal-number', '1/60'],
			['zgal-boolean', '#t'],
			['zgal-string', '"s"'],
		]);
	});

	it('shows markup in the source as text', async () => {
		const source = '; <b>bold</b>\n(f "<img src=x>")';
		serve(source);
		render(<ProgramSource url="/demo.zgal" name="demo.zgal" />);

		const listing = screen.getByLabelText('demo.zgal');
		await waitFor(() => expect(listing.textContent).toBe(source));
		expect(listing.querySelector('b, img')).toBeNull();
	});

	it('numbers its lines outside the text, one per line of the source', async () => {
		// A string across lines, an empty line, and no newline at the end
		const source = '(f "two\nlines")\n\n(app Demo)';
		serve(source);
		render(<ProgramSource url="/demo.zgal" name="demo.zgal" />);

		const listing = screen.getByLabelText('demo.zgal');
		await waitFor(() => expect(listing.textContent).toBe(source));
		expect(listing).toHaveClass('numbered');
		// The theme numbers each .code-line with a counter: the numbers aren't in the text copied
		const lines = [...listing.querySelectorAll('code > .code-line')].map(line => line.textContent);
		expect(lines).toEqual(['(f "two\n', 'lines")\n', '\n', '(app Demo)']);
		// The string is coloured on both of its lines
		expect([...listing.querySelectorAll('.zgal-string')].map(span => span.textContent)).toEqual(['"two\n', 'lines"']);
	});

	it('numbers no empty line after a final newline', async () => {
		const source = '(app Demo)\n(f 1)\n';
		serve(source);
		render(<ProgramSource url="/demo.zgal" name="demo.zgal" />);

		const listing = screen.getByLabelText('demo.zgal');
		await waitFor(() => expect(listing.textContent).toBe(source));
		expect(listing.querySelectorAll('.code-line')).toHaveLength(2);
	});

	it('numbers the lines of every example as the source has them', async () => {
		expect(EXAMPLES).toContain('image_filter');
		for (const name of EXAMPLES) {
			const source = readFileSync(resolve(EXAMPLES_DIR, name, `${name}.zgal`), 'utf8');
			serve(source);
			const { unmount } = render(<ProgramSource url={`/${name}.zgal`} name={name} />);
			const listing = screen.getByLabelText(name);
			await waitFor(() => expect(listing.textContent).toBe(source));
			const lines = source.endsWith('\n') ? source.slice(0, -1).split('\n') : source.split('\n');
			expect([...listing.querySelectorAll('.code-line')].map(line => line.textContent!.replace(/\n$/, ''))).toEqual(lines);
			unmount();
		}
	});
});
