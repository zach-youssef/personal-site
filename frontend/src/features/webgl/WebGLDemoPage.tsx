import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, ButtonGroup, ButtonToolbar, Container, Form } from 'react-bootstrap';
import { CameraMode, WebGLDemo } from './WebGLDemo';
import { sceneAssets } from './sceneAssets';

// Each camera with its keyboard shortcut, as a KeyboardEvent code
const CAMERAS: [string, CameraMode, string][] = [
	['Front', CameraMode.Front, 'KeyF'],
	['Top', CameraMode.Top, 'KeyO'],
	['Rotate', CameraMode.Rotate, 'KeyT'],
	['Plane', CameraMode.Plane, 'KeyA'],
	['Ground', CameraMode.Ground, 'KeyP'],
];
const TOGGLE_PATH_KEY = 'KeyS';

function WebGLDemoPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const demoRef = useRef<WebGLDemo | null>(null);
	const [frameRate, setFrameRate] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [cameraMode, setCameraMode] = useState(CameraMode.Front);
	const [drawPath, setDrawPath] = useState(false);

	// The demo draws into the canvas until the page is left
	useEffect(() => {
		const demo = WebGLDemo.create(canvasRef.current!, sceneAssets, setFrameRate);
		if (demo === null) {
			setError('This demo needs a browser that supports WebGL.');
			return;
		}
		demoRef.current = demo;
		let isMounted = true;
		demo.loaded.catch(loadError => {
			console.error(loadError);
			if (isMounted) {
				setError("The scene couldn't be loaded.");
			}
		});
		return () => {
			isMounted = false;
			demoRef.current = null;
			demo.dispose();
		};
	}, []);

	useEffect(() => {
		demoRef.current?.setCameraMode(cameraMode);
	}, [cameraMode]);

	useEffect(() => {
		demoRef.current?.setDrawPath(drawPath);
	}, [drawPath]);

	// Keyboard shortcuts for the buttons; shortcuts with modifiers belong to the browser
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return;
			}
			const camera = CAMERAS.find(([, , key]) => key === event.code);
			if (camera) {
				setCameraMode(camera[1]);
			} else if (event.code === TOGGLE_PATH_KEY) {
				setDrawPath(draw => !draw);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);

	// The current camera takes the theme's button colour
	return (
		<Container>
			{error && <Alert variant="danger">{error}</Alert>}
			<canvas
				ref={canvasRef}
				aria-label="WebGL Demo"
				style={{ display: 'block', width: '100%', maxWidth: 540, aspectRatio: '1' }}
			/>
			<div>Frame rate: {frameRate === null ? '' : frameRate.toFixed(1)}</div>
			<ButtonToolbar className="align-items-center">
				<ButtonGroup aria-label="Camera">
					{CAMERAS.map(([label, mode]) => (
						<Button
							key={label}
							variant={mode === cameraMode ? 'primary' : 'secondary'}
							aria-pressed={mode === cameraMode}
							onClick={() => setCameraMode(mode)}
						>
							{label}
						</Button>
					))}
				</ButtonGroup>
				<Form.Check
					type="switch"
					id="plane-path"
					role="switch"
					label="Plane Path"
					checked={drawPath}
					onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDrawPath(event.target.checked)}
				/>
			</ButtonToolbar>
		</Container>
	);
}

export default WebGLDemoPage
