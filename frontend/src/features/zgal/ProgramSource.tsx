import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

interface Props {
	// Where the backend serves the program's source
	url: string,
	// The program's file name, which labels the listing
	name: string,
}

// Lists a ZGAL program's source, fetched from the backend. Give each program its own instance (key
// it by the program), so another program's listing starts from 'Loading…' rather than the last one's
function ProgramSource({ url, name }: Props) {
	const [source, setSource] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let mounted = true;
		fetch(url)
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
			<code>{source ?? 'Loading…'}</code>
		</pre>
	);
}

export default ProgramSource;
