// The mount API of a ZGAL program's generated main (<name>.zgal.main.js), as ZGAL's documentation
// describes it ("Other pages embed programs", dsl/docs/zgal.scrbl; web/zgal/main-browser.ts). The
// site doesn't build against ZGAL's runtime, since each program ships its own copy beside its main,
// so these types are written out here and checked only by use.

// running: it started; stopped: the app quit, ran its --frames, printed its usage or was stopped;
// failed: it couldn't start, threw, or WebGPU reported errors
export type ProgramState = 'running' | 'stopped' | 'failed';

// How the canvas is shown in its parent: at the largest whole multiple of its size that fits,
// pixelated (pixel art), or at the largest size that fits, smoothly scaled
export type Scaling = 'whole-multiples' | 'fit';

// Called as a program's assets' bytes arrive: the asset's path as the program opens it, the bytes
// loaded so far and its total size, or null while that isn't known (a compressed response, or no
// Content-Length); once the asset has ended, the last call gives total = loaded
export type AssetProgress = (path: string, loaded: number, total: number | null) => void;

export interface MountOptions {
	scaling: Scaling,
	// The program's command line, as under Node (e.g. ['--frames', '60'])
	args?: readonly string[],
	// Key presses from the canvas while it has focus (it takes focus when clicked), or the whole page
	keys?: 'canvas' | 'page',
	onState?(state: ProgramState): void,
	// The program's messages (errors, usage); by default the runtime logs them
	onMessage?(text: string): void,
	// Added to ZGAL after mount itself: builds from before it ignore the option and never call it,
	// so a page mustn't depend on it (e.g. hide a progress bar until the first call)
	onProgress?: AssetProgress,
}

export interface MountedProgram {
	// Stops the program, while it starts too, and frees its WebGPU device, its graphs, the canvas's
	// configuration and its listeners on the page. The same promise each time.
	stop(): Promise<void>,
}

// What the site uses of a program's main module
export interface ZgalProgramModule {
	// Runs the program in the canvas, shown at the centre of the canvas's parent, which must have a
	// size of its own; its assets are fetched from assets/ beside the main
	mount(canvas: HTMLCanvasElement, options: MountOptions): MountedProgram,
}

// Loads a program's main module from its URL
export type ZgalLoader = (mainUrl: string) => Promise<ZgalProgramModule>;

// Imports the main at run time: the site's bundler mustn't resolve or bundle it, as the backend
// serves it (under /assets, which the dev and preview servers forward to the backend)
export const importProgram: ZgalLoader = mainUrl => import(/* @vite-ignore */ mainUrl);
