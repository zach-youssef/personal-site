import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { tokenizeZgal, TokenKind } from './highlightZgal';

interface Props {
	// Where the backend serves the program's source
	url: string,
	// The program's file name, which labels the listing
	name: string,
}

// The kinds of token the listing colours, by their class; the theme styles .zgal-<kind>
const COLOURED: TokenKind[] = ['comment', 'string', 'number', 'boolean', 'keyword', 'head'];

// The source as one span per line, each line's text with its coloured tokens in spans, never as
// HTML, so the listing's text (and what selecting and copying it gives) is the source exactly. A
// line's span ends with its newline; the theme numbers the lines with a CSS counter, which isn't
// part of the text. A token across lines (a multi-line comment or string) is split at each newline.
function highlight(source: string): ReactNode[] {
	const lines: ReactNode[] = [];
	let line: ReactNode[] = [];
	let plain = '';
	const flush = () => {
		if (plain) {
			line.push(plain);
			plain = '';
		}
	};
	const endLine = () => {
		flush();
		lines.push(<span key={lines.length} className="code-line">{line}</span>);
		line = [];
	};
	tokenizeZgal(source).forEach(({ kind, text }, i) => {
		const coloured = COLOURED.includes(kind);
		text.split(/(?<=\n)/).forEach((part, j) => {
			if (coloured) {
				flush();
				line.push(<span key={`${i}.${j}`} className={`zgal-${kind}`}>{part}</span>);
			} else {
				plain += part;
			}
			if (part.endsWith('\n')) {
				endLine();
			}
		});
	});
	// A last line without its newline; a source ending with one has no empty line after it
	flush();
	if (line.length > 0) {
		endLine();
	}
	return lines;
}

// Lists a ZGAL program's source, fetched from the backend. Give each program its own instance (key
// it by the program), so another program's listing starts from 'Loading…' rather than the last one's
function ProgramSource({ url, name }: Props) {
	const [source, setSource] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const highlighted = useMemo(() => source === null ? null : highlight(source), [source]);

	useEffect(() => {
		let mounted = true;
		fetch(url, { cache: 'no-cache' })
			.then(response => {
				if (!response.ok) {
					throw new Error(`${url}: ${response.status}`);
				}
				return response.text();
			})
			.then(text => mounted && setSource(text))
			.catch(error => {
				console.error(error);
				if (mounted) {
					setFailed(true);
				}
			});
		return () => {
			mounted = false;
		};
	}, [url]);

	if (failed) {
		return <Alert variant="danger">The program's source couldn't be loaded.</Alert>;
	}
	return (
		<pre className={highlighted ? 'code-listing numbered' : 'code-listing'} aria-label={name} tabIndex={0}>
			<code>{highlighted ?? 'Loading…'}</code>
		</pre>
	);
}

export default ProgramSource;
