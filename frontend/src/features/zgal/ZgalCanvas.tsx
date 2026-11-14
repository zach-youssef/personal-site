import React, { useEffect, useRef, useState } from 'react';
import {
	AssetProgress, importProgram, MountedProgram, ProgramState, Scaling, ZgalLoader,
} from './zgalMount';

// 'loading' while the program's main loads (after the previous program's stop) and until it reports
// its first state
export type CanvasState = 'loading' | ProgramState;

// Settles once every program a ZgalCanvas stopped has finished stopping, which each mount waits for,
// whichever instance it is in: each program has its own WebGPU device and its own copy of its assets,
// so a canvas re-keyed, swapped for another or reached again by navigating back mustn't hold a second
// copy (e.g. of a large scene, on a phone) while the last one still stops. The wait is bounded by
// STOP_WAIT_MS: a stop can hang (the runtime's stop awaits its asset downloads, which a dead
// connection stalls), and an unbounded wait would then keep every later canvas on the site loading
// until a reload. Past the cap the mount goes ahead with a warning, so a second copy is possible only
// after a stop has hung.
export const STOP_WAIT_MS = 10_000;
let pendingStops: Promise<void> = Promise.resolve();

interface Props {
	// The program's main module, <name>.zgal.main.js, which exports mount
	mainUrl: string,
	// The box's aspect ratio, normally the program's size (--size); the canvas is scaled into it
	width: number,
	height: number,
	scaling: Scaling,
	// The program's command line; a change restarts it
	args?: readonly string[],
	// The canvas's accessible name
	title: string,
	// Called with 'loading' as each mount starts (the first, and after a prop change), then with each
	// state of the program this canvas runs now, and with 'failed' when its main doesn't load or mount
	// throws. A program stopped by an unmount or a prop change isn't reported.
	onState?(state: CanvasState): void,
	// The program's messages (errors, usage) and load failures; by default to the console. Messages of
	// a program being stopped go to the console.
	onMessage?(text: string): void,
	// As its assets' bytes arrive; never called by ZGAL builds older than the option. Whether there is
	// one is read as each mount starts: without it, the runtime doesn't count the bytes at all.
	onProgress?: AssetProgress,
	// Loads the main; tests pass a fake module instead of importing one
	load?: ZgalLoader,
	// For the box, e.g. a maximum height; style overrides the box's own (width, background)
	className?: string,
	style?: React.CSSProperties,
}

// The box the program's canvas is shown in: the runtime centres the canvas in its parent, which must
// have a size of its own, so the box takes the column's width and the program's aspect ratio
function boxStyle(width: number, height: number, style?: React.CSSProperties): React.CSSProperties {
	return {
		position: 'relative',
		width: '100%',
		aspectRatio: `${width} / ${height}`,
		overflow: 'hidden',
		background: '#000',
		...style,
	};
}

// Runs a ZGAL program in a canvas of the page (its main's mount), rather than a frame of its own
// page. Keys come from the canvas while it has focus (keys: 'canvas'), so the page keeps scrolling.
// A change of the main, its scaling, its command line or the loader stops the program and mounts it
// again in the same canvas; unmounting stops it. Every mount waits, for at most STOP_WAIT_MS, until the
// programs any ZgalCanvas stopped have stopped (pendingStops). The box's data-zgal attribute gives the state, for tests and styles.
function ZgalCanvas({
	mainUrl, width, height, scaling, args = [], title, onState, onMessage, onProgress,
	load = importProgram, className, style,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [state, setState] = useState<CanvasState>('loading');
	// The callbacks may be new functions on every render; reading them through a ref keeps a
	// re-render from restarting the program
	const callbacks = useRef({ onState, onMessage, onProgress });
	callbacks.current = { onState, onMessage, onProgress };
	// Compared by value, so an inline array literal doesn't restart the program on every render
	const argsKey = JSON.stringify(args);

	useEffect(() => {
		const canvas = canvasRef.current!;
		const commandLine: readonly string[] = JSON.parse(argsKey);
		// Set by the cleanup: this mount's program stops, and nothing of it reaches the page
		let current = true;
		let program: MountedProgram | null = null;
		const report = (next: CanvasState) => {
			if (current) {
				setState(next);
				callbacks.current.onState?.(next);
			}
		};
		const message = (text: string) => {
			((current && callbacks.current.onMessage) || console.log)(text);
		};
		report('loading');

		const previous = pendingStops;
		const started = (async () => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const timedOut = await Promise.race([
				previous.then(() => false),
				new Promise<boolean>(resolve => {
					timer = setTimeout(() => resolve(true), STOP_WAIT_MS);
				}),
			]);
			clearTimeout(timer);
			if (timedOut && current) {
				console.warn(`${mainUrl}: the previous program is still stopping after ${STOP_WAIT_MS / 1000} s; starting anyway`);
			}
			if (!current) {
				return;
			}
			const module = await load(mainUrl);
			if (!current) {
				return;
			}
			if (typeof module?.mount !== 'function') {
				throw new Error(`${mainUrl} doesn't export mount`);
			}
			program = module.mount(canvas, {
				scaling,
				args: commandLine,
				keys: 'canvas',
				onState: report,
				onMessage: message,
				onProgress: callbacks.current.onProgress && ((path, loaded, total) => {
					if (current) {
						callbacks.current.onProgress?.(path, loaded, total);
					}
				}),
			});
		})().catch(error => {
			message(`${mainUrl}: ${error instanceof Error ? error.message : String(error)}`);
			report('failed');
		});

		return () => {
			current = false;
			// The program may still be loading: stop it once mount has returned, if it got that far.
			// A failing stop mustn't keep the next mount from starting.
			const stopped = started
				.then(() => program?.stop())
				.catch(error => console.error(error));
			pendingStops = Promise.all([pendingStops, stopped]).then(() => undefined);
		};
	}, [mainUrl, scaling, argsKey, load]);

	return (
		<div className={className} style={boxStyle(width, height, style)} data-zgal={state}>
			<canvas ref={canvasRef} aria-label={title} />
		</div>
	);
}

export default ZgalCanvas;
