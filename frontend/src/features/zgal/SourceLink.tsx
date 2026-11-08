import React, { useEffect, useState } from 'react';
import type { ZgalSample } from './samples';

// Where ./build-zgal records which commit of ZGAL the samples' copied sources come from
export const MANIFEST_URL = '/assets/zgal/source.json';

// The server caches assets for a day, each file on its own. Revalidating both the manifest and the
// listing keeps the link and the listing from coming from different deploys
export const FRESH: RequestInit = { cache: 'no-cache' };

// What ./build-zgal writes to source.json
export interface SourceManifest {
	// The ZGAL repository's GitHub URL, from the site's .gitmodules
	repository: string,
	// The commit the sources were copied from
	commit: string,
	// Whether GitHub may not have the sources at that commit (a local or changed checkout)
	dirty: boolean,
}

// 'loading' until the manifest arrives, and 'failed' when it can't be loaded or isn't one
export type ManifestState = SourceManifest | 'loading' | 'failed';

function isManifest(value: unknown): value is SourceManifest {
	const manifest = value as Partial<SourceManifest> | null;
	return typeof manifest?.repository === 'string' && manifest.repository.startsWith('https://')
		&& typeof manifest.commit === 'string' && /^[0-9a-f]{40,64}$/.test(manifest.commit)
		&& typeof manifest.dirty === 'boolean';
}

// Loads the manifest once, for every sample the page shows
export function useSourceManifest(): ManifestState {
	const [manifest, setManifest] = useState<ManifestState>('loading');

	useEffect(() => {
		let mounted = true;
		fetch(MANIFEST_URL, FRESH)
			.then(response => {
				if (!response.ok) {
					throw new Error(`${MANIFEST_URL}: ${response.status}`);
				}
				return response.json();
			})
			.then((value: unknown) => {
				if (!isManifest(value)) {
					throw new Error(`${MANIFEST_URL} isn't a source manifest: ${JSON.stringify(value)}`);
				}
				if (mounted) {
					setManifest(value);
				}
			})
			.catch(error => {
				console.error(error);
				if (mounted) {
					setManifest('failed');
				}
			});
		return () => {
			mounted = false;
		};
	}, []);

	return manifest;
}

// One line of the link's text, reserved while it isn't there yet
const LINE: React.CSSProperties = { minHeight: '1.5em' };

// The sample's source on GitHub, at the commit its copy comes from
export function githubSource(manifest: SourceManifest, sample: ZgalSample): string {
	return `${manifest.repository}/blob/${manifest.commit}/examples/${sample.directory}/${sample.source}`;
}

// Links the sample's listing to its source on GitHub at the commit it was copied from, or says it's
// a local build when GitHub may not have that commit. Stays an empty line until the manifest arrives
// (so the listing doesn't jump), and when it fails to load: the listing itself never depends on it
function SourceLink({ manifest, sample }: { manifest: ManifestState, sample: ZgalSample }) {
	if (manifest === 'loading' || manifest === 'failed') {
		return <p className="small mb-2" style={LINE} aria-hidden="true" />;
	}
	return (
		<p className="small mb-2" style={LINE}>
			{manifest.dirty
				? <span className="text-muted" title="These sources aren't at a commit on GitHub">local build</span>
				: <a href={githubSource(manifest, sample)} title={manifest.commit}>
					View on GitHub at {manifest.commit.slice(0, 7)}
				</a>}
		</p>
	);
}

export default SourceLink;
