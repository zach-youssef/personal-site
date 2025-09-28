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
                While it can render textured objects, these models are limited to a small set of primitives (cubes, cylinders, cones, spheres) for which ray intersection was implemented.
                The final product, being browser based, is quite slow. 
                Below are some sample output images that highlight reflective surfaces and refraction when passing through a transparent sphere.
            </p>
            <Carousel fade>
                {images && 
                    images.map(src => (
                        <Carousel.Item>
                            <img 
                                src={src}
                                className="d-block w-100"
                                alt="Demo"
                            />
                        </Carousel.Item>
                    ))
                }
            </Carousel>
        </div>
    );
}

export default RaytracerPage;