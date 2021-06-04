import React from 'react'
import { ProjectDisplayCard } from './ProjectDisplay';
import logo192 from '../../logo192.png';
import { CardGroup } from 'react-bootstrap';

function ProjectDisplayContainer(){
    // TODO replace with load from somewhere else
    let projectInfos = [
        {title: "Sokoban AI", description: "An A* and Q learning implementation to solve the game Sokoban", imagePath: logo192, id: "sokoban"},
        {title: "SeamCarver", description: "An implementation of the seam carving algorithm used to change an image's aspect ratio", imagePath: logo192, id: "seamCarver"},
        {title: "Simple Raytracer", description: "A simple raytracing render algorithim", imagePath: logo192, id: "raytracer"},
        {title: "WebGL Demo", description: "A small interactive WebGL animation from my Graphics class", imagePath: logo192, id: "webglDemo"},
    ]
    
    return(
        <CardGroup>
            {projectInfos.map((projectInfo, index) => <ProjectDisplayCard projectInfo={projectInfo} index={0} />)}
        </CardGroup>
    )
}

export default ProjectDisplayContainer;