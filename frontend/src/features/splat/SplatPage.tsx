import React, { useCallback, useRef, useState } from 'react';
import { Alert, Button, ButtonToolbar, Container } from 'react-bootstrap';
import ZgalCanvas, { CanvasState } from '../zgal/ZgalCanvas';
import { hasWebGPU } from '../zgal/ZgalFrame';
import type { ZgalLoader } from '../zgal/zgalMount';
import { megabytes, parseSize, SceneInfo, useScene } from './scene';

export const GITHUB_URL = 'https://github.com/zach-youssef/vk_splats';
export const ZGAL_PAGE = '/projects/zgal';
const TITLE = 'Gaussian splatting viewer';
// The screenshot's description, wherever it stands in for the viewer
const SCREENSHOT_ALT = "The viewer's start view (screenshot)";

// Touch devices (a coarse primary pointer: phones, tablets) don't download the scene until asked:
// it's large for a metered connection, and needs a GPU that can hold it
export function prefersPoster(): boolean {
	return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
		&& window.matchMedia('(pointer: coarse)').matches;
}

// The viewer's controls; keys reach it while it has focus, so the page scrolls as usual otherwise
const CONTROLS: [string, string][] = [
	['W, A, S, D', 'move forward, left, back, right'],
	['Q, E', 'sink, rise'],
	['Drag', 'look around (with the mouse or one finger)'],
	['Scroll', 'move faster (up) or slower (down)'],
	['Esc', 'stop the viewer'],
];

// The view's box: the viewer's aspect ratio, the column's width
function viewStyle(scene: SceneInfo): React.CSSProperties {
	const { width, height } = parseSize(scene.size)!;
	return { display: 'block', width: '100%', aspectRatio: `${width} / ${height}`, background: '#000' };
}

// Bytes arrived out of the scene's total (scene.json's, whatever the responses say), summed over its
// files, in whole percent; null until the first report, since builds without onProgress never send
// one. done once every byte has arrived, or once every file reported (the stream among them) has
// ended, which also covers files smaller than scene.json says (e.g. a stream cached from before a
// scene was swapped). Re-renders only when the percentage or done changes, not on every chunk.
function useProgress(total: number, streamPath: string) {
	const files = useRef(new Map<string, { loaded: number, ended: boolean }>());
	const [percent, setPercent] = useState<number | null>(null);
	const [done, setDone] = useState(false);
	const onProgress = useCallback((path: string, loaded: number, size: number | null) => {
		// The runtime's last call for a file gives its size, at the latest once it has ended
		files.current.set(path, { loaded, ended: size !== null && loaded >= size });
		let sum = 0;
		let ended = files.current.has(streamPath);
		files.current.forEach(file => {
			sum += file.loaded;
			ended &&= file.ended;
		});
		setPercent(Math.min(100, Math.floor(sum / total * 100)));
		setDone(sum >= total || ended);
	}, [total, streamPath]);
	const reset = useCallback(() => {
		files.current.clear();
		setPercent(null);
		setDone(false);
	}, []);
	return { percent, done, onProgress, reset };
}

interface ViewProps {
	scene: SceneInfo,
	load?: ZgalLoader,
	// Whether the canvas takes focus once the viewer runs: when a button press started it, which
	// would otherwise leave focus on the page as the button goes; not when it starts with the page,
	// whose keys would then stop scrolling it
	focusOnStart: boolean,
}

// The running viewer, its progress bar while the scene streams in, and the screenshot with an alert
// when it fails; Esc stops it, after which it can be started again
function SceneView({ scene, load, focusOnStart }: ViewProps) {
	const [state, setState] = useState<CanvasState>('loading');
	const [run, setRun] = useState(0);
	const { percent, done, onProgress, reset } = useProgress(scene.bytes, scene.stream.path);
	const box = useRef<HTMLDivElement>(null);
	const focusWhenRunning = useRef(focusOnStart);
	const onState = (next: CanvasState) => {
		setState(next);
		if (next === 'running' && focusWhenRunning.current) {
			focusWhenRunning.current = false;
			box.current?.querySelector('canvas')?.focus({ preventScroll: true });
		}
	};
	const { width, height } = parseSize(scene.size)!;

	if (state === 'failed') {
		return (
			<>
				<Alert variant="danger">
					The viewer couldn't run in this browser, so this is what it draws at the start view.
				</Alert>
				<img src={scene.screenshot} alt={SCREENSHOT_ALT} className="splat-frame" style={viewStyle(scene)} />
			</>
		);
	}

	const restart = () => {
		reset();
		focusWhenRunning.current = true;
		setRun(run + 1);
	};
	// Shown while bytes are still to come; a stopped or failed viewer downloads no more
	const showProgress = percent !== null && !done && state !== 'stopped';
	return (
		<div className="position-relative" ref={box}>
			<ZgalCanvas
				key={run}
				className="splat-view"
				mainUrl={scene.viewer}
				width={width}
				height={height}
				scaling="fit"
				args={scene.args}
				title={TITLE}
				load={load}
				onState={onState}
				onProgress={onProgress}
				// The screenshot shows through until the viewer draws its first frame
				style={{ background: `#000 url("${scene.screenshot}") center / contain no-repeat` }}
			/>
			{showProgress && (
				<div className="splat-progress">
					{/* Written out rather than react-bootstrap's ProgressBar, which puts the label on its
					    outer box rather than the progressbar */}
					<div className="progress">
						<div
							className="progress-bar"
							role="progressbar"
							aria-label={`Loading the scene: ${percent}% of ${megabytes(scene.bytes)}`}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={percent!}
							style={{ width: `${percent}%` }}
						/>
					</div>
				</div>
			)}
			{state === 'stopped' && (
				<div className="splat-overlay">
					<Button variant="primary" onClick={restart}>Restart the viewer</Button>
				</div>
			)}
		</div>
	);
}

// The screenshot, with a button that starts the viewer: the scene downloads only once asked
function Poster({ scene, onStart }: { scene: SceneInfo, onStart(): void }) {
	return (
		<div className="position-relative">
			<img src={scene.screenshot} alt={SCREENSHOT_ALT} className="splat-frame" style={viewStyle(scene)} />
			<div className="splat-overlay">
				<Button variant="primary" onClick={onStart}>View in 3D ({megabytes(scene.bytes)})</Button>
			</div>
		</div>
	);
}

// Links the viewer to its source on GitHub at the commit it was built from, or says it's a local
// build when GitHub may not have that commit
function ViewerSource({ scene }: { scene: SceneInfo }) {
	const { repository, commit, dirty } = scene.source;
	return (
		<p className="small mt-2 mb-3">
			{dirty
				? <span className="text-muted" title="This viewer isn't built from a commit on GitHub">local build</span>
				: <a href={`${repository}/tree/${commit}`} title={commit}>Viewer built from {commit.slice(0, 7)}</a>}
			{' · '}
			<a href={scene.release.url}>Scene: release {scene.release.tag}</a>
		</p>
	);
}

interface Props {
	// Loads the viewer's main; tests pass a fake module
	load?: ZgalLoader,
}

function SplatPage({ load }: Props) {
	const webGPU = hasWebGPU();
	const scene = useScene();
	// Desktops start the viewer as the page opens; touch devices on the poster's button
	const [poster] = useState(prefersPoster);
	const [started, setStarted] = useState(!poster);
	const loaded = typeof scene === 'object';

	let view: React.ReactNode;
	if (scene === 'failed') {
		view = <Alert variant="danger">The scene couldn't be loaded. Please try again later.</Alert>;
	} else if (scene === 'loading') {
		view = null;
	} else if (!webGPU) {
		view = (
			<>
				<Alert variant="warning">
					The viewer needs a browser that supports WebGPU, so this is what it draws at the start view.
				</Alert>
				<img src={scene.screenshot} alt={SCREENSHOT_ALT} className="splat-frame" style={viewStyle(scene)} />
			</>
		);
	} else if (started) {
		view = <SceneView scene={scene} load={load} focusOnStart={poster} />;
	} else {
		view = <Poster scene={scene} onStart={() => setStarted(true)} />;
	}

	return (
		<Container>
			<h2>Gaussian Splatting</h2>
			<p>
				3D Gaussian splatting (Kerbl et al., SIGGRAPH 2023) represents a scene as hundreds of
				thousands of small, semi-transparent, coloured Gaussians, fitted to photos of it. This
				project implements it in ZGAL, the GPU language I made: a trainer that fits the splats to
				the photos, and a viewer that draws them. Both run on Vulkan and, as on this page, on WebGPU.
			</p>
			<p>
				The trainer renders as the paper does, with a tile-based rasterizer in compute shaders,
				since training needs each pixel's gradients. The viewer below draws the same splats with
				the GPU's own rasterizer instead: each splat is a quad, sorted back to front and blended,
				which is faster and draws nearly the same image. It streams the scene in,
				so the view fills in as it downloads.
			</p>
			<p>
				The scene is {loaded ? scene.splats.toLocaleString('en-US') : 'about 330,000'} splats,
				trained for 7,000 iterations on 40 of the 46 photos of a capture from my computer vision
				class (CS 5330); it reaches 20.41 dB PSNR on the other six, held out from training.
				{loaded && ` Streamed in a compact format, it's a ${megabytes(scene.bytes)} download.`}
			</p>
			<ButtonToolbar className="mb-4">
				<Button variant="primary" href={GITHUB_URL} className="mr-2 mb-2">View on GitHub</Button>
				<Button variant="outline-primary" href={ZGAL_PAGE} className="mb-2">About ZGAL</Button>
			</ButtonToolbar>
			{view}
			{loaded && <ViewerSource scene={scene} />}
			<h4>Controls</h4>
			<p className="mb-2">Click or tap the view first, then:</p>
			<dl className="row mb-0">
				{CONTROLS.map(([key, action]) => (
					<React.Fragment key={key}>
						<dt className="col-4 col-md-2">{key}</dt>
						<dd className="col-8 col-md-10 mb-1">{action}</dd>
					</React.Fragment>
				))}
			</dl>
		</Container>
	);
}

export default SplatPage;
