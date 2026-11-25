import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProgramSource from './ProgramSource';

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
		const spans = [...listing.querySelectorAll('span')].map(span => [span.className, span.textContent]);
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
});
