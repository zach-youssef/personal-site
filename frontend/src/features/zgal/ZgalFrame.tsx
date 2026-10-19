import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-bootstrap';

// ZGAL programs run on WebGPU, which not every browser has yet
export function hasWebGPU(): boolean {
	return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

// How the program's canvas fills the frame. The page runner shows it at the largest whole multiple
// of the program's size that fits, which keeps pixel art square but crops a canvas larger than the
// frame; 'fit' scales it to the frame instead.
export type Scaling = 'whole-multiples' | 'fit';

// Overrides the runner's inline canvas size; the runner maps the cursor through the canvas's
// on-screen rectangle, so input still lines up
const FIT_STYLE = 'canvas#zgal { width: 100% !important; height: 100% !important; object-fit: contain; }';

interface Props {
	// The program's generated page, <name>.zgal.html
	src: string,
	title: string,
	style: React.CSSProperties,
	scaling: Scaling,
}

// Runs a ZGAL program for the web in a frame of its generated page, as ZGAL's page runner takes
// over the whole document it runs in (its canvas, title and window-wide input listeners)
function ZgalFrame({ src, title, style, scaling }: Props) {
	const frameRef = useRef<HTMLIFrameElement>(null);
	const [failed, setFailed] = useState(false);

	// The runner records its state as <html data-zgal="running|stopped|failed">; the frame is
	// same-origin, so a failure (e.g. a browser with WebGPU but no adapter) can be shown here
	useEffect(() => {
		const frame = frameRef.current!;
		let observer: MutationObserver | null = null;
		const watch = () => {
			observer?.disconnect();
			const root = frame.contentDocument?.documentElement;
			if (!root) {
				return;
			}
			if (scaling === 'fit') {
				const fit = frame.contentDocument!.createElement('style');
				fit.textContent = FIT_STYLE;
				frame.contentDocument!.head.append(fit);
			}
			const check = () => setFailed(root.dataset.zgal === 'failed');
			observer = new MutationObserver(check);
			observer.observe(root, { attributes: true, attributeFilter: ['data-zgal'] });
			check();
		};
		frame.addEventListener('load', watch);
		return () => {
			frame.removeEventListener('load', watch);
			observer?.disconnect();
		};
	}, [scaling]);

	return (
		<>
			{failed && <Alert variant="danger">{title} couldn't run in this browser.</Alert>}
			<iframe ref={frameRef} src={src} title={title} loading="lazy" style={style} />
		</>
	);
}

export default ZgalFrame;
