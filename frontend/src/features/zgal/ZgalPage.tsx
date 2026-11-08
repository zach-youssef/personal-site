import React, { useState } from 'react';
import { Alert, Button, ButtonGroup, ButtonToolbar, Col, Container, Row } from 'react-bootstrap';
import { useHistory, useLocation } from 'react-router-dom';
import ZgalFrame, { hasWebGPU } from './ZgalFrame';
import ProgramSource from './ProgramSource';
import SourceLink, { ManifestState, useSourceManifest } from './SourceLink';
import { programPage, programSource, SAMPLES, screenshot, ZgalSample } from './samples';

export const GITHUB_URL = 'https://github.com/zach-youssef/vulkan_testing';
// ZGAL's documentation, which ./build-zgal builds and the backend serves
export const DOCS_URL = '/zgal/docs/';
// The query parameter that names the selected sample, so a link can open the page on it
const SAMPLE_PARAM = 'sample';

// The sample a page URL's query selects: the first (particles) when it names none or one the page
// doesn't have
function selectedSample(search: string): ZgalSample {
	const id = new URLSearchParams(search).get(SAMPLE_PARAM);
	return SAMPLES.find(sample => sample.id === id) ?? SAMPLES[0];
}

// Runs a sample beside its source, or shows a frame it drew when the browser has no WebGPU
// manifest: which commit the copied sources come from, which links the listing to GitHub there
// run: changing it restarts the program in a new frame, e.g. after its Esc stopped it
export function SampleView({ sample, webGPU, manifest, run = 0 }:
	{ sample: ZgalSample, webGPU: boolean, manifest: ManifestState, run?: number }) {
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
					? <ZgalFrame key={run} src={programPage(sample)} title={sample.title} style={frameStyle} scaling={sample.scaling} />
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
				<SourceLink manifest={manifest} sample={sample} />
				<ProgramSource url={programSource(sample)} name={sample.source} />
			</Col>
		</Row>
	);
}

function ZgalPage() {
	const webGPU = hasWebGPU();
	const location = useLocation();
	const history = useHistory();
	const sample = selectedSample(location.search);
	// Loaded once for every sample, not again on switching
	const manifest = useSourceManifest();
	// Choosing the selected sample again restarts it
	const [run, setRun] = useState(0);

	const select = (choice: ZgalSample) => {
		if (choice.id === sample.id) {
			setRun(run + 1);
			return;
		}
		// Replaced rather than pushed: switching samples isn't a page to go back to
		const search = new URLSearchParams(location.search);
		search.set(SAMPLE_PARAM, choice.id);
		history.replace({ ...location, search: `?${search}` });
	};

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
				{webGPU
					? "Below, the web build of one of its examples runs beside the program it was compiled from. Choose an example to switch to it, or the one that's running to restart it."
					: 'Below, a frame from one of its examples is shown beside the program it was compiled from. Choose an example to switch to it.'}
			</p>
			<ButtonToolbar className="mb-4">
				<Button variant="primary" href={GITHUB_URL} className="mr-2 mb-2">View on GitHub</Button>
				<Button variant="outline-primary" href={DOCS_URL} className="mb-2">Read the documentation</Button>
			</ButtonToolbar>
			{!webGPU && (
				<Alert variant="warning">
					This program needs a browser that supports WebGPU, so below is a frame from it.
				</Alert>
			)}
			<ButtonToolbar>
				<ButtonGroup aria-label="Example">
					{SAMPLES.map(choice => (
						<Button
							key={choice.id}
							variant={choice.id === sample.id ? 'primary' : 'secondary'}
							aria-pressed={choice.id === sample.id}
							// Its description: choosing the running example restarts it
							title={webGPU && choice.id === sample.id ? 'Restart' : undefined}
							onClick={() => select(choice)}
						>
							{choice.title}
						</Button>
					))}
				</ButtonGroup>
			</ButtonToolbar>
			<p>{sample.blurb}</p>
			<SampleView sample={sample} webGPU={webGPU} manifest={manifest} run={run} />
		</Container>
	);
}

export default ZgalPage;
