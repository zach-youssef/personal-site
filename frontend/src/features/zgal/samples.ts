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
	// What the program does, shown above it when it's selected
	blurb: string,
	// The program's own controls, as its main lists them: [key, action]
	controls: [string, string][],
}

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
