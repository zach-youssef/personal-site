import React from 'react';
import { Alert, Button, Col, Container, Row } from 'react-bootstrap';
import ZgalFrame, { hasWebGPU } from '../zgal/ZgalFrame';

export const GITHUB_URL = 'https://github.com/zach-youssef/vk_ppu';

// The games ./build-ppu builds into the backend's assets
const GAMES = [
	{ id: 'smb3', title: 'Super Mario Bros. 3' },
	{ id: 'batman', title: 'Batman' },
];

export const gamePage = (id: string) => `/assets/ppu/${id}/${id}.zgal.html`;
export const gameScreenshot = (id: string) => `/assets/ppu/${id}/screenshot.png`;

// The NES draws 256 x 240 pixels; the frame holds them at twice that, and the game picks the
// largest whole scale that fits, so its pixels stay square on narrow screens too
const FRAME_STYLE: React.CSSProperties = {
	display: 'block',
	width: '100%',
	maxWidth: 512,
	aspectRatio: '256 / 240',
	border: 0,
	background: '#000',
};

function PpuPage() {
	const webGPU = hasWebGPU();
	return (
		<Container>
			<h2>Vulkan Retro PPU</h2>
			<p>
				The NES draws its frames with a picture processing unit (PPU), which composes the screen
				from 8 x 8 pixel tiles, palettes and sprites held in its own memory. This project
				reimplements it as a compute shader, rendering memory dumped from an emulator into an
				image every frame, and animates two title screens the way the games do.
				The games are written in ZGAL, a language I made for declaring shaders, render graphs and
				apps, which compiles them to Vulkan and, for this page, to WebGPU.
			</p>
			<Button variant="primary" href={GITHUB_URL} className="mb-4">View on GitHub</Button>
			{!webGPU && (
				<Alert variant="warning">
					These games need a browser that supports WebGPU, so below is a frame from each.
				</Alert>
			)}
			<Row>
				{GAMES.map(game => (
					<Col key={game.id} lg={6} className="mb-4">
						<h4>{game.title}</h4>
						{webGPU
							? <ZgalFrame src={gamePage(game.id)} title={game.title} style={FRAME_STYLE} scaling="whole-multiples" />
							: <img src={gameScreenshot(game.id)} alt={game.title} style={{ ...FRAME_STYLE, imageRendering: 'pixelated' }} />}
					</Col>
				))}
			</Row>
		</Container>
	);
}

export default PpuPage;
