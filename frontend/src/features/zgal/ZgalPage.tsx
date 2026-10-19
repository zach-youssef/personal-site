import React, { useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Row } from 'react-bootstrap';
import ZgalFrame, { hasWebGPU } from './ZgalFrame';

export const GITHUB_URL = 'https://github.com/zach-youssef/vulkan_testing';

// What ./build-zgal builds into the backend's assets: the particles example's generated page, the
// program it was built from and a frame it drew
export const PROGRAM_PAGE = '/assets/zgal/particles/particles.zgal.html';
export const PROGRAM_SOURCE = '/assets/zgal/particles/particles.zgal';
export const SCREENSHOT = '/assets/zgal/particles/screenshot.webp';

const TITLE = 'Particles';

// The program asks for a 1280 x 800 window, which the frame scales to fit
const FRAME_STYLE: React.CSSProperties = {
	display: 'block',
	width: '100%',
	aspectRatio: '1280 / 800',
	border: 0,
	background: '#000',
};

// The program's own controls, as its main lists them; the frame takes them once clicked
const CONTROLS = [
	['Left mouse', 'attract the particles to the cursor'],
	['Space', 'pause or resume'],
	['R', 'reset the particles'],
	['1, 2, 3', 'frames in flight'],
];

function ProgramSource() {
	const [source, setSource] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let mounted = true;
		fetch(PROGRAM_SOURCE)
			.then(response => {
				if (!response.ok) {
					throw new Error(`${PROGRAM_SOURCE}: ${response.status}`);
				}
				return response.text();
			})
			.then(text => mounted && setSource(text))
			.catch(error => {
				console.error(error);
				if (mounted) {
					setFailed(true);
				}
			});
		return () => {
			mounted = false;
		};
	}, []);

	if (failed) {
		return <Alert variant="danger">The program's source couldn't be loaded.</Alert>;
	}
	return (
		<pre className="code-listing" aria-label="particles.zgal" tabIndex={0}>
			<code>{source ?? 'Loading…'}</code>
		</pre>
	);
}

function ZgalPage() {
	const webGPU = hasWebGPU();
	return (
		<Container>
			<h2>ZGAL</h2>
			<p>
				ZGAL is a language I made for writing GPU programs whole: shaders, the render graph that
				orders and synchronizes them, and the app that feeds them input, all in one file. It's
				embedded in Racket, and compiles a program to GLSL and C++ for my Vulkan wrapper, or to
				WGSL and TypeScript for WebGPU. The render graph places barriers and semaphores and spreads
				work across the GPU's queues, so programs never write them.
			</p>
			<p>
				Below, the web build of its particle example runs beside the program it was compiled from:
				a compute pass pulls a hundred thousand particles towards an attractor, and a graphics pass
				draws them with additive blending.
			</p>
			<Button variant="primary" href={GITHUB_URL} className="mb-4">View on GitHub</Button>
			{!webGPU && (
				<Alert variant="warning">
					This program needs a browser that supports WebGPU, so below is a frame from it.
				</Alert>
			)}
			<Row>
				<Col lg={6} className="mb-4">
					<h4>{TITLE}</h4>
					{webGPU
						? <ZgalFrame src={PROGRAM_PAGE} title={TITLE} style={FRAME_STYLE} scaling="fit" />
						: <img src={SCREENSHOT} alt={TITLE} style={FRAME_STYLE} />}
					<dl className="row mt-3 mb-0">
						{CONTROLS.map(([key, action]) => (
							<React.Fragment key={key}>
								<dt className="col-4">{key}</dt>
								<dd className="col-8 mb-1">{action}</dd>
							</React.Fragment>
						))}
					</dl>
				</Col>
				<Col lg={6} className="mb-4">
					<h4>particles.zgal</h4>
					<ProgramSource />
				</Col>
			</Row>
		</Container>
	);
}

export default ZgalPage;
