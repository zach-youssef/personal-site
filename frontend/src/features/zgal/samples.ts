import type { Scaling } from './ZgalFrame';

// Where ./build-zgal puts each sample's build in the backend's assets: /assets/zgal/<directory>/
const ASSETS = '/assets/zgal';

// A ZGAL example the page shows: its web build runs in a frame beside the program it was compiled
// from, or a frame it drew stands in for it in a browser without WebGPU
export interface ZgalSample {
	id: string,
	title: string,
	// A program that runs in its generated page
	kind: 'program',
	// The sample's directory under /assets/zgal
	directory: string,
	// The program's file name; its generated page is <source>.html
	source: string,
	// The window size the program asks for, which the frame keeps the aspect ratio of
	width: number,
	height: number,
	scaling: Scaling,
	// What the program does, for the page's introduction
	blurb: string,
	// The program's own controls, as its main lists them: [key, action]
	controls: [string, string][],
}

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
		blurb: 'Below, the web build of its particle example runs beside the program it was compiled from: ' +
			'a compute pass pulls a hundred thousand particles towards an attractor, and a graphics pass ' +
			'draws them with additive blending.',
		controls: [
			['Left mouse', 'attract the particles to the cursor'],
			['Space', 'pause or resume'],
			['R', 'reset the particles'],
			['1, 2, 3', 'frames in flight'],
		],
	},
];

// The sample's generated page, the program it was built from and a frame it drew
export function programPage(sample: ZgalSample): string {
	return `${ASSETS}/${sample.directory}/${sample.source}.html`;
}

export function programSource(sample: ZgalSample): string {
	return `${ASSETS}/${sample.directory}/${sample.source}`;
}

export function screenshot(sample: ZgalSample): string {
	return `${ASSETS}/${sample.directory}/screenshot.webp`;
}
