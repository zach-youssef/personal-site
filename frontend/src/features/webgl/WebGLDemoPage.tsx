import React from 'react'
import ServerDomain from './../../ServerDomain';

function WebGLDemoPage() {
	return (
		<iframe 
			title="WebGL Demo"
			src={`http://${ServerDomain}/Scenegraphs.html`}
			width="800" 
			height="800"
		/>
	);
}

export default WebGLDemoPage
