import { useEffect, useState } from 'react';

// What ./build-splat writes for the page, so the page hard-codes nothing about the scene or where
// the backend serves it
export const SCENE_URL = '/assets/splat/scene.json';

// The server caches assets for a day, each file on its own; revalidating the description keeps its
// sizes and command line from coming from another deploy than the page
const FRESH: RequestInit = { cache: 'no-cache' };

export interface SceneFile {
	path: string,
	bytes: number,
	sha256: string,
}

// scene.json, as ./build-splat writes it
export interface SceneInfo {
	// splat_view's main (splat_view.zgal.main.js), which the page mounts
	viewer: string,
	// What the viewer draws at the start view, for browsers that can't run it
	screenshot: string,
	stream: SceneFile,
	cameras: SceneFile,
	// Every byte the viewer downloads (the stream and the cameras): the progress bar's total
	bytes: number,
	splats: number,
	shDegree: number,
	streamVersion: number,
	// The viewer's --size, WxH
	size: string,
	// The viewer's command line
	args: string[],
	// The vk_splats release the scene's files come from
	release: { tag: string, url: string },
	// The vk_splats commit the viewer was built from; dirty when GitHub may not have it there
	source: { repository: string, commit: string, dirty: boolean },
}

// 'loading' until the description arrives, and 'failed' when it can't be loaded or isn't one
export type SceneState = SceneInfo | 'loading' | 'failed';

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function isFile(value: unknown): value is SceneFile {
	const file = value as Partial<SceneFile> | null;
	return isString(file?.path) && isNumber(file.bytes) && isString(file.sha256);
}

// Checks what the page relies on, so a description from another version of build-splat fails
// visibly rather than mounting the viewer with a broken command line
export function isSceneInfo(value: unknown): value is SceneInfo {
	const scene = value as Partial<SceneInfo> | null;
	return isString(scene?.viewer) && isString(scene.screenshot)
		&& isFile(scene.stream) && isFile(scene.cameras)
		&& isNumber(scene.bytes) && scene.bytes > 0 && isNumber(scene.splats)
		&& typeof scene.size === 'string' && parseSize(scene.size) !== null
		&& Array.isArray(scene.args) && scene.args.every(arg => typeof arg === 'string')
		&& isString(scene.release?.tag) && isString(scene.release.url)
		&& isString(scene.source?.repository) && isString(scene.source.commit)
		&& typeof scene.source.dirty === 'boolean';
}

// The width and height of a WxH size, or null when it isn't one
export function parseSize(size: string): { width: number, height: number } | null {
	const match = /^([1-9][0-9]*)x([1-9][0-9]*)$/.exec(size);
	return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

// A download's size for people, in whole megabytes (10^6 bytes), as the release lists it
export function megabytes(bytes: number): string {
	return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

// Loads scene.json once
export function useScene(): SceneState {
	const [scene, setScene] = useState<SceneState>('loading');

	useEffect(() => {
		let mounted = true;
		fetch(SCENE_URL, FRESH)
			.then(response => {
				if (!response.ok) {
					throw new Error(`${SCENE_URL}: ${response.status}`);
				}
				return response.json();
			})
			.then((value: unknown) => {
				if (!isSceneInfo(value)) {
					throw new Error(`${SCENE_URL} isn't a scene description: ${JSON.stringify(value)}`);
				}
				if (mounted) {
					setScene(value);
				}
			})
			.catch(error => {
				console.error(error);
				if (mounted) {
					setScene('failed');
				}
			});
		return () => {
			mounted = false;
		};
	}, []);

	return scene;
}
