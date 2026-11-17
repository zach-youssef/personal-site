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

// The source as text with its coloured tokens in spans, never as HTML, so the listing's text (and
// what selecting and copying it gives) is the source exactly
function highlight(source: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let plain = '';
	tokenizeZgal(source).forEach(({ kind, text }, i) => {
		if (COLOURED.includes(kind)) {
			if (plain) {
				nodes.push(plain);
				plain = '';
			}
			nodes.push(<span key={i} className={`zgal-${kind}`}>{text}</span>);
		} else {
			plain += text;
		}
	});
	if (plain) {
		nodes.push(plain);
	}
	return nodes;
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
		<pre className="code-listing" aria-label={name} tabIndex={0}>
			<code>{highlighted ?? 'Loading…'}</code>
		</pre>
	);
}

export default ProgramSource;
