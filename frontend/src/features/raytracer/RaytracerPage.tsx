import React, { useEffect, useState } from 'react';
import { Carousel } from 'react-bootstrap';
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
            <Carousel fade>
                {images && 
                    images.map(src => (
                        <Carousel.Item>
                            <img 
                                src={src}
                                className="d-block w-100"
                            />
                        </Carousel.Item>
                    ))
                }
            </Carousel>
        </div>
    );
}

export default RaytracerPage;