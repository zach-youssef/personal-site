import React from 'react'
import ProjectInfo from './ProjectInfo';
import { ProjectDisplayCard } from './ProjectDisplay';
import logo192 from '../../logo192.png';
import { CardGroup } from 'react-bootstrap';

function ProjectDisplayContainer(){
    // TODO replace with load from somewhere else
    let projectInfos = [
        new ProjectInfo("Sokoban AI", "An A* and Q learning implementation to solve the game Sokoban", logo192),
        new ProjectInfo("SeamCarver", "An implementation of the seam carving algorithm used to change an image's aspect ratio", logo192),
        new ProjectInfo("Simple Raytracer", "A simple raytracing render algorithim", logo192),
        new ProjectInfo("WebGL Demo", "A small interactive WebGL animation from my Graphics class", logo192),
    ]
    
    return(
        <CardGroup>
            {projectInfos.map((projectInfo, index) => <ProjectDisplayCard projectInfo={projectInfo} index={0} />)}
        </CardGroup>
    )
}

export default ProjectDisplayContainer;