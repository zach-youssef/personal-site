import React, {useLayoutEffect, useState} from 'react'
import ServerDomain from './../../ServerDomain';
import { Container } from 'react-bootstrap';

function WebGLDemoPage() {
    const [screenWidth, setScreenWidth] = useState(1024);
	const [screenHeight, setScreenHeight] = useState(1024);
	const updateScreenSize = () => {
		setScreenWidth(window.innerWidth);
		setScreenHeight(window.innerHeight);
	};
    useLayoutEffect(() => {
        updateScreenSize();
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, []);

	return (
		<Container>
			<iframe 
				title="WebGL Demo"
				src={`http://${ServerDomain}/Scenegraphs.html`}
				width={540}
				height={540}
			/>
		</Container>
	);
}

export default WebGLDemoPage
