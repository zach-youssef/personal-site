import React, { useRef, useEffect, useState } from 'react'
import { Controller } from './lib/src/Controller';
import { View } from './lib/src/View';
import { setupWebGL } from './lib/src/common/WebGLUtils'

function WebGLDemoPage() {
	let gl: WebGLRenderingContext;
	let view: View;
	let controller: Controller;

	const renderCanvas = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = renderCanvas.current

		if (canvas === null || canvas === undefined) {
			// TODO handling?
			console.log('Could not get canvas');
		}

		gl = setupWebGL(canvas!, {
			'antialias' : true, 
			'alpha' : false, 
			'depth' : true, 
			'stencil' : false
		});

		if (gl == null) {
			alert("Unable to inititalize WebGL. Your browser or machine may not support it.")
			return;
		}

		view = new View(gl)
		controller = new Controller(view)
		controller.go();

		tick()

		// return () => view.freeMeshes()
	});

	function tick() {
		view.animate()
		view.draw()
		requestAnimationFrame(tick)
	}

	return (
		<canvas 
			width={800} // TODO find a better way to determine size
			height={800}
			ref={renderCanvas}
		/>
	);
}

export default WebGLDemoPage