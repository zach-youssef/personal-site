import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SplatPage, { GITHUB_URL, ZGAL_PAGE } from './SplatPage';
import { isSceneInfo, megabytes, parseSize, SCENE_URL, SceneInfo } from './scene';
import type { MountOptions, ZgalLoader, ZgalProgramModule } from '../zgal/zgalMount';

const SCENE: SceneInfo = {
	viewer: '/assets/splat/viewer/splat_view.zgal.main.js',
	screenshot: '/assets/splat/screenshot.webp',
	stream: { path: '/assets/splat/scene/scene.stream', bytes: 26200832, sha256: 'a'.repeat(64) },
	cameras: { path: '/assets/splat/scene/cameras.bin', bytes: 5152, sha256: 'b'.repeat(64) },
	bytes: 26205984,
	splats: 327505,
	shDegree: 3,
	streamVersion: 1,
	size: '1280x720',
	args: ['/assets/splat/scene/scene.stream', '--cameras', '/assets/splat/scene/cameras.bin',
		'--camera', '34', '--size', '1280x720', '--stream-words', '262144'],
	release: {
		tag: 'scene-cs5330-7k-ms20-v1',
		url: 'https://github.com/zach-youssef/vk_splats/releases/tag/scene-cs5330-7k-ms20-v1',
	},
	source: { repository: 'https://github.com/zach-youssef/vk_splats', commit: 'c'.repeat(40), dirty: false },
};

const SCREENSHOT = "The viewer's start view (screenshot)";

interface FakeMount {
	options: MountOptions,
	finishStop(): void,
}

// Every mount's stop is finished after each test: a ZgalCanvas waits for any pending stop, which
// is module state shared across tests
const everyMount: FakeMount[] = [];

function fakeViewer() {
	const mounts: FakeMount[] = [];
	const module: ZgalProgramModule = {
		mount: (canvas, options) => {
			// As the runtime does when it takes keys on the canvas
			canvas.tabIndex = 0;
			let finishStop!: () => void;
			const stopped = new Promise<void>(resolve => {
				finishStop = resolve;
			});
			const mounted = { options, finishStop };
			mounts.push(mounted);
			everyMount.push(mounted);
			return { stop: () => stopped };
		},
	};
	const load = vi.fn<ZgalLoader>(async () => module);
	return { mounts, load };
}

// Serves scene.json (or fails with the given status)
function serveScene(scene: unknown = SCENE, status = 200) {
	const fetchMock = vi.fn(async () => new Response(JSON.stringify(scene), { status }));
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function setWebGPU(available: boolean) {
	if (available) {
		Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
	} else {
		delete (navigator as { gpu?: unknown }).gpu;
	}
}

// A coarse primary pointer (a phone or tablet), or a fine one
function setCoarsePointer(coarse: boolean) {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: coarse && query === '(pointer: coarse)',
		media: query,
	}));
}

function canvas() {
	return screen.getByLabelText('Gaussian splatting viewer', { selector: 'canvas' });
}

function progressBar() {
	return screen.queryByRole('progressbar');
}

beforeEach(() => {
	setWebGPU(true);
	setCoarsePointer(false);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
	cleanup();
	everyMount.forEach(mount => mount.finishStop());
	everyMount.length = 0;
	await new Promise(resolve => setTimeout(resolve, 0));
	setWebGPU(false);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('SplatPage', () => {
	it("mounts the viewer with the scene's command line on desktop as the page opens", async () => {
		const fetchMock = serveScene();
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);

		await waitFor(() => expect(mounts).toHaveLength(1));
		expect(fetchMock).toHaveBeenCalledWith(SCENE_URL, { cache: 'no-cache' });
		expect(load).toHaveBeenCalledWith(SCENE.viewer);
		expect(mounts[0].options).toMatchObject({ scaling: 'fit', args: SCENE.args, keys: 'canvas' });
		const canvas = screen.getByLabelText('Gaussian splatting viewer');
		expect(canvas.tagName).toBe('CANVAS');
		expect(canvas.parentElement).toHaveClass('splat-view');
		expect(canvas.parentElement!.style.aspectRatio).toBe('1280 / 720');

		expect(screen.getByText(/327,505 splats/)).toBeInTheDocument();
		expect(screen.getByText(/it's a 26 MB download/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', GITHUB_URL);
		expect(screen.getByRole('link', { name: 'About ZGAL' })).toHaveAttribute('href', ZGAL_PAGE);
		expect(screen.getByRole('link', { name: `Viewer built from ${'c'.repeat(7)}` }))
			.toHaveAttribute('href', `${SCENE.source.repository}/tree/${SCENE.source.commit}`);
		expect(screen.getByRole('link', { name: `Scene: release ${SCENE.release.tag}` }))
			.toHaveAttribute('href', SCENE.release.url);
		expect(screen.getByText('Click or tap the view first, then:')).toBeInTheDocument();
	});

	it("says a local build's viewer isn't on GitHub", async () => {
		serveScene({ ...SCENE, source: { ...SCENE.source, dirty: true } });
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);

		await waitFor(() => expect(mounts).toHaveLength(1));
		expect(screen.getByText('local build')).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /Viewer built from/ })).not.toBeInTheDocument();
	});

	it("shows the scene's download until every byte has arrived", async () => {
		serveScene();
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);
		await waitFor(() => expect(mounts).toHaveLength(1));
		const { onProgress } = mounts[0].options;

		// None before the first report: an older runtime never sends one
		act(() => mounts[0].options.onState!('running'));
		expect(progressBar()).not.toBeInTheDocument();

		act(() => onProgress!(SCENE.cameras.path, SCENE.cameras.bytes, SCENE.cameras.bytes));
		// A wrong size from the response: scene.json's total counts, not the responses' sizes
		act(() => onProgress!(SCENE.stream.path, SCENE.stream.bytes / 2, SCENE.stream.bytes * 2));
		expect(progressBar()).toHaveAttribute('aria-valuenow', '50');
		expect(progressBar()).toHaveAccessibleName('Loading the scene: 50% of 26 MB');

		act(() => onProgress!(SCENE.stream.path, SCENE.stream.bytes, null));
		expect(progressBar()).not.toBeInTheDocument();
	});

	it('hides the download once every file has ended, even short of the total', async () => {
		serveScene();
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);
		await waitFor(() => expect(mounts).toHaveLength(1));
		const { onProgress } = mounts[0].options;

		// The cameras alone having ended isn't the end: the stream is yet to open
		act(() => onProgress!(SCENE.cameras.path, SCENE.cameras.bytes, SCENE.cameras.bytes));
		expect(progressBar()).toHaveAttribute('aria-valuenow', '0');

		// A stream smaller than scene.json says (e.g. cached from an earlier scene)
		const short = SCENE.stream.bytes - 1000;
		act(() => onProgress!(SCENE.stream.path, 0, short));
		act(() => onProgress!(SCENE.stream.path, short / 2, short));
		expect(progressBar()).toBeInTheDocument();
		act(() => onProgress!(SCENE.stream.path, short, short));
		expect(progressBar()).not.toBeInTheDocument();
	});

	it('hides the download when the viewer stops, and restarts it on asking', async () => {
		serveScene();
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);
		await waitFor(() => expect(mounts).toHaveLength(1));
		act(() => mounts[0].options.onProgress!(SCENE.stream.path, 1000, SCENE.stream.bytes));
		expect(progressBar()).toBeInTheDocument();

		act(() => mounts[0].options.onState!('stopped'));
		expect(progressBar()).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Restart the viewer' }));
		mounts[0].finishStop();

		await waitFor(() => expect(mounts).toHaveLength(2));
		expect(screen.queryByRole('button', { name: 'Restart the viewer' })).not.toBeInTheDocument();
		// The new run starts its count afresh
		expect(progressBar()).not.toBeInTheDocument();
		act(() => mounts[1].options.onProgress!(SCENE.stream.path, SCENE.stream.bytes / 4, SCENE.stream.bytes));
		expect(progressBar()).toHaveAttribute('aria-valuenow', '24');
		// The button that restarted it is gone, so the view takes focus
		act(() => mounts[1].options.onState!('running'));
		expect(canvas()).toHaveFocus();
	});

	it('leaves focus on the page when the viewer starts with it', async () => {
		serveScene();
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);
		await waitFor(() => expect(mounts).toHaveLength(1));

		act(() => mounts[0].options.onState!('running'));
		expect(canvas()).not.toHaveFocus();
	});

	it('shows the screenshot and an alert when the viewer fails', async () => {
		serveScene();
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);
		await waitFor(() => expect(mounts).toHaveLength(1));

		act(() => mounts[0].options.onState!('failed'));
		expect(screen.getByRole('alert')).toHaveTextContent("The viewer couldn't run in this browser");
		expect(screen.getByRole('img', { name: SCREENSHOT }))
			.toHaveAttribute('src', SCENE.screenshot);
		expect(screen.queryByLabelText('Gaussian splatting viewer', { selector: 'canvas' })).not.toBeInTheDocument();
	});

	it("shows the screenshot and an alert when the viewer's main doesn't load", async () => {
		serveScene();
		const load = vi.fn<ZgalLoader>(async () => {
			throw new Error('404');
		});
		vi.spyOn(console, 'log').mockImplementation(() => {});
		render(<SplatPage load={load} />);

		expect(await screen.findByRole('alert')).toHaveTextContent("The viewer couldn't run in this browser");
	});

	it('shows a poster with an opt-in button on touch devices, and mounts only once asked', async () => {
		setCoarsePointer(true);
		serveScene();
		const { mounts, load } = fakeViewer();
		render(<SplatPage load={load} />);

		const start = await screen.findByRole('button', { name: 'View in 3D (26 MB)' });
		expect(screen.getByRole('img', { name: SCREENSHOT }))
			.toHaveAttribute('src', SCENE.screenshot);
		expect(load).not.toHaveBeenCalled();

		await userEvent.click(start);
		await waitFor(() => expect(mounts).toHaveLength(1));
		expect(screen.queryByRole('button', { name: /View in 3D/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('img', { name: SCREENSHOT })).not.toBeInTheDocument();
		act(() => mounts[0].options.onState!('running'));
		expect(canvas()).toHaveFocus();
	});

	it('shows the screenshot and an alert without WebGPU', async () => {
		setWebGPU(false);
		serveScene();
		const { load } = fakeViewer();
		render(<SplatPage load={load} />);

		expect(await screen.findByRole('alert')).toHaveTextContent('needs a browser that supports WebGPU');
		expect(screen.getByRole('img', { name: SCREENSHOT }))
			.toHaveAttribute('src', SCENE.screenshot);
		expect(screen.queryByRole('button', { name: /View in 3D/ })).not.toBeInTheDocument();
		expect(load).not.toHaveBeenCalled();
	});

	it.each([
		['is missing', SCENE, 404],
		["isn't a scene description", { ...SCENE, args: 'scene.stream' }, 200],
	])('says the scene failed to load when scene.json %s', async (_, scene, status) => {
		serveScene(scene, status);
		const { load } = fakeViewer();
		render(<SplatPage load={load} />);

		expect(await screen.findByRole('alert')).toHaveTextContent("The scene couldn't be loaded");
		expect(load).not.toHaveBeenCalled();
		expect(screen.queryByRole('link', { name: /Viewer built from/ })).not.toBeInTheDocument();
	});
});

describe('scene', () => {
	it('accepts what build-splat writes and rejects what the page can not use', () => {
		expect(isSceneInfo(SCENE)).toBe(true);
		expect(isSceneInfo(null)).toBe(false);
		expect(isSceneInfo({ ...SCENE, size: '1280' })).toBe(false);
		expect(isSceneInfo({ ...SCENE, bytes: 0 })).toBe(false);
		expect(isSceneInfo({ ...SCENE, args: ['x', 1] })).toBe(false);
		expect(isSceneInfo({ ...SCENE, stream: { path: 'x' } })).toBe(false);
		expect(isSceneInfo({ ...SCENE, source: { ...SCENE.source, dirty: 'no' } })).toBe(false);
	});

	it('parses sizes and rounds downloads to whole megabytes', () => {
		expect(parseSize('1280x720')).toEqual({ width: 1280, height: 720 });
		expect(parseSize('0x720')).toBeNull();
		expect(parseSize('1280x720x1')).toBeNull();
		expect(megabytes(26205984)).toBe('26 MB');
		expect(megabytes(472432)).toBe('1 MB');
	});
});
