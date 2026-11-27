import type { Scaling } from './ZgalFrame';

// Where ./build-zgal puts each sample's build in the backend's assets: /assets/zgal/<directory>/
const ASSETS = '/assets/zgal';

// What every ZGAL example the page shows has: its web build runs beside the program it was compiled
// from, or something it drew stands in for it in a browser without WebGPU
interface SampleBase {
	id: string,
	title: string,
	// The sample's directory under /assets/zgal
	directory: string,
	// The program's file name; its generated page is <source>.html and its main <source>.main.js
	source: string,
	// What the program does, shown above it when it's selected
	blurb: string,
}

// A program with a window, which runs in a frame of its generated page; a screenshot of it stands in
// for it without WebGPU
export interface WindowSample extends SampleBase {
	kind: 'program',
	// The window size the program asks for, which the frame keeps the aspect ratio of
	width: number,
	height: number,
	scaling: Scaling,
	// The program's own controls, as its main lists them: [key, action]
	controls: [string, string][],
}

// A program without a window (a command-line image filter), which the page runs headless from its
// main with its own controls, showing its input beside the PNG it writes. Without WebGPU, or when the
// run fails, the input and output ./build-zgal filtered stand in for it.
export interface HeadlessSample extends SampleBase {
	kind: 'headless',
	// Files in the sample's directory, compressed for showing: the default input, and its output
	// filtered at build time with the page's default options
	fallbackInput: string,
	fallbackOutput: string,
}

export type ZgalSample = WindowSample | HeadlessSample;

// The samples the page offers, in the selector's order; the first, particles, is the one it shows
// unless the URL picks another
export const SAMPLES: ZgalSample[] = [
	{
		id: 'particles',
		title: 'Particles',
		kind: 'program',
		directory: 'particles',
		source: 'particles.zgal',
		width: 1280,
		height: 800,
		scaling: 'fit',
		blurb: 'A compute pass pulls a hundred thousand particles towards an attractor, and a graphics ' +
			'pass draws them with additive blending.',
		controls: [
			['Left mouse', 'attract the particles to the cursor'],
			['Space', 'pause or resume'],
			['R', 'reset the particles'],
			['1, 2, 3', 'frames in flight'],
		],
	},
	{
		id: 'scene',
		title: 'Scene',
		kind: 'program',
		directory: 'scene',
		source: 'scene.zgal',
		width: 1280,
		height: 720,
		scaling: 'fit',
		blurb: 'A lit 3D scene loaded from a glTF file, drawn like a usual forward renderer: a shadow ' +
			'map from the sun, PBR shading into an HDR image, and a tonemap to the screen. The render ' +
			'graph orders the three passes and places their barriers from what each one uses.',
		controls: [
			['Drag', 'orbit the camera'],
			['Scroll', 'zoom'],
			['L', "toggle the light's animation"],
			['S', 'toggle shadows'],
			['+ / -', 'exposure'],
			['Esc', 'stops the program'],
		],
	},
	{
		id: 'raymarch',
		title: 'Raymarch',
		kind: 'program',
		directory: 'raymarch',
		source: 'raymarch.zgal',
		width: 1280,
		height: 800,
		scaling: 'fit',
		blurb: 'A scene of signed distance fields drawn by one fragment shader, with no meshes: each ' +
			'pixel marches a ray until it hits a sphere, a torus or a rounded box, blended with smooth ' +
			'unions over a checkered floor, and shades it with soft shadows and ambient occlusion.',
		controls: [
			['Drag', 'orbit the camera'],
			['Scroll', 'zoom'],
			['T', 'toggle the camera turning by itself'],
			['Space', 'pause or resume the animation'],
			['Esc', 'stops the program'],
		],
	},
	{
		id: 'image_filter',
		title: 'Image filter',
		kind: 'headless',
		directory: 'image_filter',
		source: 'image_filter.zgal',
		blurb: 'A command-line image filter, and an example of a program without a window: a Gaussian ' +
			'blur in linear light, Sobel edges and a black-and-white threshold, each a compute pass that ' +
			'the render graph enables as asked. Here it runs on WebGPU as it would from a shell, and ' +
			'shows the PNG it writes.',
		fallbackInput: 'input.webp',
		fallbackOutput: 'blur_edges.webp',
	},
];

// The sample's generated page and main, the program it was built from, a frame it drew and its other
// files
export function programPage(sample: ZgalSample): string {
	return `${ASSETS}/${sample.directory}/${sample.source}.html`;
}

export function programSource(sample: ZgalSample): string {
	return `${ASSETS}/${sample.directory}/${sample.source}`;
}

export function programMain(sample: ZgalSample): string {
	return `${ASSETS}/${sample.directory}/${sample.source}.main.js`;
}

export function screenshot(sample: WindowSample): string {
	return sampleFile(sample, 'screenshot.webp');
}

// A file in the sample's directory, e.g. its assets/input.png
export function sampleFile(sample: ZgalSample, file: string): string {
	return `${ASSETS}/${sample.directory}/${file}`;
}
