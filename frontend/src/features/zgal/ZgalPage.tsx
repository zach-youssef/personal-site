import React from 'react';
import { Alert, Button, ButtonToolbar, Col, Container, Row } from 'react-bootstrap';
import ZgalFrame, { hasWebGPU } from './ZgalFrame';
import ProgramSource from './ProgramSource';
import { programPage, programSource, SAMPLES, screenshot, ZgalSample } from './samples';

export const GITHUB_URL = 'https://github.com/zach-youssef/vulkan_testing';
// ZGAL's documentation, which ./build-zgal builds and the backend serves
export const DOCS_URL = '/zgal/docs/';

// Runs a sample beside its source, or shows a frame it drew when the browser has no WebGPU
export function SampleView({ sample, webGPU }: { sample: ZgalSample, webGPU: boolean }) {
	const frameStyle: React.CSSProperties = {
		display: 'block',
		width: '100%',
		aspectRatio: `${sample.width} / ${sample.height}`,
		border: 0,
		background: '#000',
	};
	// Keyed by the sample, so another sample gets a new frame and listing rather than the last one's
	// state (a failed alert, or a listing whose fetch is still running)
	return (
		<Row key={sample.id}>
			<Col lg={6} className="mb-4">
				<h4>{sample.title}</h4>
				{webGPU
					? <ZgalFrame src={programPage(sample)} title={sample.title} style={frameStyle} scaling={sample.scaling} />
					: <img src={screenshot(sample)} alt={sample.title} style={frameStyle} />}
				{/* The frame takes the program's controls once clicked */}
				<dl className="row mt-3 mb-0">
					{sample.controls.map(([key, action]) => (
						<React.Fragment key={key}>
							<dt className="col-4">{key}</dt>
							<dd className="col-8 mb-1">{action}</dd>
						</React.Fragment>
					))}
				</dl>
			</Col>
			<Col lg={6} className="mb-4">
				<h4>{sample.source}</h4>
				<ProgramSource url={programSource(sample)} name={sample.source} />
			</Col>
		</Row>
	);
}

function ZgalPage() {
	const webGPU = hasWebGPU();
	const sample = SAMPLES[0];
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
			<p>{sample.blurb}</p>
			<ButtonToolbar className="mb-4">
				<Button variant="primary" href={GITHUB_URL} className="mr-2 mb-2">View on GitHub</Button>
				<Button variant="outline-primary" href={DOCS_URL} className="mb-2">Read the documentation</Button>
			</ButtonToolbar>
			{!webGPU && (
				<Alert variant="warning">
					This program needs a browser that supports WebGPU, so below is a frame from it.
				</Alert>
			)}
			<SampleView sample={sample} webGPU={webGPU} />
		</Container>
	);
}

export default ZgalPage;
