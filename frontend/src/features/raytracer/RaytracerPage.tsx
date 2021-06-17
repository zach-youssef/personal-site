import React, { useEffect, useState } from 'react';
import { fetchGraphQL } from '../../FetchHelper';

function RaytracerPage () {
    const [images, setImages] = useState([])
    useEffect(() => {
        fetchGraphQL(`
            query {
                raytracerImages
            }
        `, {}).then(response => {
            setImages(response.data.raytracerImages)
        })
    });
    return (
        <div>
            <h2>Browser Raytracer</h2>
            <p>
                At the end of my graduate graphics course, we implemented a Raytracer in typescript that was capable of shadows, reflections, and transparency with refraction.
                The final product, being browser based, is quite slow. This page will display some sample renders until I finally get around to implementing a CUDA implementation.
            </p>
            {images && images.map(src => <img src={src}/> )}
        </div>
    );
}

export default RaytracerPage;