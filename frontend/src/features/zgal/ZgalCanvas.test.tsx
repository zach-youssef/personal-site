import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ZgalCanvas, { STOP_WAIT_MS } from './ZgalCanvas';
import type { MountOptions, ZgalLoader, ZgalProgramModule } from './zgalMount';

// A program mounted by the fake module: what it was given, and a stop the test resolves
interface FakeMount {
	canvas: HTMLCanvasElement,
	options: MountOptions,
	stop: ReturnType<typeof vi.fn>,
	// Resolves the stop promise, as the runtime does once the device is destroyed
	finishStop(): void,
}

// Every fake program mounted, whose stops each test finishes: mounts wait for any ZgalCanvas's
// pending stop, so one left pending would hold up the next test
const everyMount: FakeMount[] = [];

afterEach(async () => {
	cleanup();
	everyMount.forEach(mount => mount.finishStop());
	everyMount.length = 0;
	await new Promise(resolve => setTimeout(resolve, 0));
});

// A main module whose mount records each call; loads resolve at once unless the test holds them
function fakeProgram() {
	const mounts: FakeMount[] = [];
	const module: ZgalProgramModule = {
		mount: (canvas, options) => {
			let finishStop!: () => void;
			const stopped = new Promise<void>(resolve => {
				finishStop = resolve;
			});
			const stop = vi.fn(() => stopped);
			const mounted = { canvas, options, stop, finishStop };
			mounts.push(mounted);
			everyMount.push(mounted);
			return { stop };
		},
	};
	const load = vi.fn<ZgalLoader>(async () => module);
	return { mounts, load };
}

const MAIN = '/assets/zgal/particles/particles.zgal.main.js';

function box(): HTMLElement {
	return screen.getByLabelText('Particles').parentElement!;
}

describe('ZgalCanvas', () => {
	it("mounts the program in its canvas and reports the program's state", async () => {
		const { mounts, load } = fakeProgram();
		const onState = vi.fn();
		const onMessage = vi.fn();
		const onProgress = vi.fn();
		render(<ZgalCanvas mainUrl={MAIN} width={1024} height={640} scaling="fit"
			args={['--particles', '20000']} title="Particles" load={load}
			onState={onState} onMessage={onMessage} onProgress={onProgress} />);

		expect(box()).toHaveAttribute('data-zgal', 'loading');
		expect(box()).toHaveStyle({ position: 'relative', width: '100%' });
		expect(box().style.aspectRatio).toBe('1024 / 640');
		await waitFor(() => expect(mounts).toHaveLength(1));
		expect(load).toHaveBeenCalledWith(MAIN);
		const [mounted] = mounts;
		expect(mounted.canvas).toBe(screen.getByLabelText('Particles'));
		expect(mounted.options).toMatchObject({ scaling: 'fit', args: ['--particles', '20000'], keys: 'canvas' });

		act(() => mounted.options.onState!('running'));
		expect(box()).toHaveAttribute('data-zgal', 'running');
		expect(onState).toHaveBeenLastCalledWith('running');
		mounted.options.onMessage!('particles: hello');
		expect(onMessage).toHaveBeenCalledWith('particles: hello');
		mounted.options.onProgress!('scene.stream', 10, 100);
		expect(onProgress).toHaveBeenCalledWith('scene.stream', 10, 100);

		act(() => mounted.options.onState!('stopped'));
		expect(box()).toHaveAttribute('data-zgal', 'stopped');
		expect(onState).toHaveBeenLastCalledWith('stopped');
	});

	it("reports failed when the main doesn't load", async () => {
		const load = vi.fn<ZgalLoader>(() => Promise.reject(new Error('404')));
		const onState = vi.fn();
		const onMessage = vi.fn();
		render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit" title="Particles"
			load={load} onState={onState} onMessage={onMessage} />);

		await waitFor(() => expect(box()).toHaveAttribute('data-zgal', 'failed'));
		expect(onState).toHaveBeenCalledWith('failed');
		expect(onMessage).toHaveBeenCalledWith(`${MAIN}: 404`);
	});

	it("reports failed when the module doesn't export mount, or mount throws", async () => {
		const notAProgram = vi.fn<ZgalLoader>(async () => ({}) as ZgalProgramModule);
		const onMessage = vi.fn();
		const { unmount } = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			title="Particles" load={notAProgram} onMessage={onMessage} />);
		await waitFor(() => expect(box()).toHaveAttribute('data-zgal', 'failed'));
		expect(onMessage).toHaveBeenCalledWith(`${MAIN}: ${MAIN} doesn't export mount`);
		unmount();

		const throwing = vi.fn<ZgalLoader>(async () => ({
			mount: () => {
				throw new Error('the canvas must be in a page');
			},
		}));
		render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit" title="Particles"
			load={throwing} onMessage={onMessage} />);
		await waitFor(() => expect(box()).toHaveAttribute('data-zgal', 'failed'));
		expect(onMessage).toHaveBeenLastCalledWith(`${MAIN}: the canvas must be in a page`);
	});

	it('stops the program on unmount, and reports nothing of it afterwards', async () => {
		const { mounts, load } = fakeProgram();
		const onState = vi.fn();
		const { unmount } = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			title="Particles" load={load} onState={onState} />);
		await waitFor(() => expect(mounts).toHaveLength(1));
		act(() => mounts[0].options.onState!('running'));

		unmount();
		await waitFor(() => expect(mounts[0].stop).toHaveBeenCalledTimes(1));
		// The runtime reports the stop it was asked for; the page that asked doesn't hear of it
		mounts[0].options.onState!('stopped');
		expect(onState.mock.calls).toEqual([['loading'], ['running']]);
	});

	it('never mounts a program whose main loads after the unmount', async () => {
		const { mounts, load: loadNow } = fakeProgram();
		let finishLoad!: () => void;
		const load = vi.fn<ZgalLoader>(() => new Promise(resolve => {
			finishLoad = () => resolve(loadNow(MAIN));
		}));
		const { unmount } = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			title="Particles" load={load} />);
		await waitFor(() => expect(load).toHaveBeenCalled());

		unmount();
		finishLoad();
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(mounts).toHaveLength(0);
	});

	it('remounts on a prop change only once the previous program has stopped', async () => {
		const { mounts, load } = fakeProgram();
		const onState = vi.fn();
		const { rerender } = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			args={['--particles', '1000']} title="Particles" load={load} onState={onState} />);
		await waitFor(() => expect(mounts).toHaveLength(1));
		act(() => mounts[0].options.onState!('running'));

		rerender(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			args={['--particles', '2000']} title="Particles" load={load} onState={onState} />);
		expect(box()).toHaveAttribute('data-zgal', 'loading');
		await waitFor(() => expect(mounts[0].stop).toHaveBeenCalledTimes(1));
		// Still stopping: the next program waits, as each has its own device
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(mounts).toHaveLength(1);
		mounts[0].options.onState!('stopped');

		mounts[0].finishStop();
		await waitFor(() => expect(mounts).toHaveLength(2));
		expect(mounts[1].canvas).toBe(mounts[0].canvas);
		expect(mounts[1].options.args).toEqual(['--particles', '2000']);
		act(() => mounts[1].options.onState!('running'));
		expect(box()).toHaveAttribute('data-zgal', 'running');
		// The old program's 'stopped' never reached the page
		expect(onState.mock.calls).toEqual([['loading'], ['running'], ['loading'], ['running']]);
	});

	it('mounts the latest props after several quick changes, one program at a time', async () => {
		const { mounts, load } = fakeProgram();
		const view = (scaling: 'fit' | 'whole-multiples', args: string[]) => (
			<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling={scaling} args={args}
				title="Particles" load={load} />
		);
		const { rerender } = render(view('fit', ['1']));
		await waitFor(() => expect(mounts).toHaveLength(1));
		rerender(view('fit', ['2']));
		rerender(view('whole-multiples', ['3']));
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		mounts[0].finishStop();
		await waitFor(() => expect(mounts).toHaveLength(2));
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(mounts).toHaveLength(2);
		expect(mounts[1].options).toMatchObject({ scaling: 'whole-multiples', args: ['3'] });
		expect(mounts[0].stop).toHaveBeenCalledTimes(1);
	});

	it("doesn't restart for new callbacks or an equal command line", async () => {
		const { mounts, load } = fakeProgram();
		const first = vi.fn();
		const second = vi.fn();
		const { rerender } = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			args={['--particles', '1000']} title="Particles" load={load} onState={first} />);
		await waitFor(() => expect(mounts).toHaveLength(1));

		rerender(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			args={['--particles', '1000']} title="Particles" load={load} onState={second} />);
		act(() => mounts[0].options.onState!('running'));
		expect(mounts[0].stop).not.toHaveBeenCalled();
		expect(load).toHaveBeenCalledTimes(1);
		expect(first.mock.calls).toEqual([['loading']]);
		expect(second).toHaveBeenCalledWith('running');
	});

	it('starts after a previous stop failed', async () => {
		const failingStop = vi.fn(() => Promise.reject(new Error('device lost')));
		const mount = vi.fn(() => ({ stop: failingStop }));
		const load = vi.fn<ZgalLoader>(async () => ({ mount }));
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const { rerender, unmount } = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
				args={['1']} title="Particles" load={load} />);
			await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
			rerender(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
				args={['2']} title="Particles" load={load} />);
			await waitFor(() => expect(mount).toHaveBeenCalledTimes(2));
			expect(consoleError).toHaveBeenCalledWith(new Error('device lost'));
			// The second program's stop fails too
			unmount();
			await waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
		} finally {
			consoleError.mockRestore();
		}
	});

	it('starts anyway, with a warning, once a stop has hung for the cap', async () => {
		const { mounts, load } = fakeProgram();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const first = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
				title="Particles" load={load} />);
			await waitFor(() => expect(mounts).toHaveLength(1));
			first.unmount();
			// The first program's stop never settles (the test doesn't finish it)
			vi.useFakeTimers();
			render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit" title="Particles" load={load} />);
			await vi.advanceTimersByTimeAsync(STOP_WAIT_MS - 1);
			expect(load).toHaveBeenCalledTimes(1);
			expect(warn).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1);
			expect(load).toHaveBeenCalledTimes(2);
			expect(mounts).toHaveLength(2);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toContain('still stopping');
		} finally {
			vi.useRealTimers();
			warn.mockRestore();
		}
	});

	it('waits for an earlier instance to stop before loading, as when the user comes back', async () => {
		const { mounts, load } = fakeProgram();
		const first = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
			title="Particles" load={load} />);
		await waitFor(() => expect(mounts).toHaveLength(1));
		first.unmount();

		render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit" title="Particles" load={load} />);
		await waitFor(() => expect(mounts[0].stop).toHaveBeenCalledTimes(1));
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		// Not even imported while the first program still holds its device and assets
		expect(load).toHaveBeenCalledTimes(1);
		expect(mounts).toHaveLength(1);

		mounts[0].finishStop();
		await waitFor(() => expect(mounts).toHaveLength(2));
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('waits for a re-keyed instance to stop before mounting the new one', async () => {
		const { mounts, load } = fakeProgram();
		const view = (key: string) => (
			<ZgalCanvas key={key} mainUrl={MAIN} width={4} height={3} scaling="fit" title="Particles" load={load} />
		);
		const { rerender } = render(view('a'));
		await waitFor(() => expect(mounts).toHaveLength(1));
		rerender(view('b'));
		await waitFor(() => expect(mounts[0].stop).toHaveBeenCalledTimes(1));
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(mounts).toHaveLength(1);
		mounts[0].finishStop();
		await waitFor(() => expect(mounts).toHaveLength(2));
	});

	it('reports loading again when a prop change remounts, e.g. after a failure', async () => {
		const { mounts, load } = fakeProgram();
		const onState = vi.fn();
		const view = (args: string[]) => (
			<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit" args={args} title="Particles"
				load={load} onState={onState} />
		);
		const { rerender } = render(view(['--bad']));
		await waitFor(() => expect(mounts).toHaveLength(1));
		act(() => mounts[0].options.onState!('failed'));
		expect(onState).toHaveBeenLastCalledWith('failed');

		rerender(view(['--good']));
		expect(onState).toHaveBeenLastCalledWith('loading');
		expect(box()).toHaveAttribute('data-zgal', 'loading');
	});

	it("passes no onProgress when the page has none, and logs a stopping program's messages", async () => {
		const { mounts, load } = fakeProgram();
		const onMessage = vi.fn();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		try {
			const { unmount } = render(<ZgalCanvas mainUrl={MAIN} width={4} height={3} scaling="fit"
				title="Particles" load={load} onMessage={onMessage} style={{ maxHeight: '80vh' }} />);
			await waitFor(() => expect(mounts).toHaveLength(1));
			expect(mounts[0].options.onProgress).toBeUndefined();
			expect(box()).toHaveStyle({ maxHeight: '80vh', width: '100%' });

			unmount();
			mounts[0].options.onMessage!('particles: lost the device while stopping');
			expect(onMessage).not.toHaveBeenCalled();
			expect(log).toHaveBeenCalledWith('particles: lost the device while stopping');
		} finally {
			log.mockRestore();
		}
	});
});
