import React from 'react'
import PropTypes from 'prop-types'
import ProjectInfo from './ProjectInfo';
import ProjectDisplay from './ProjectDisplay';
import logo192 from '../../logo192.png';

function ProjectDisplayContainer({featured} : Props){
    // TODO replace with load from somewhere else
    let projectInfos = [
        new ProjectInfo("Sokoban AI", "An A* and Q learning implementation to solve the game Sokoban", logo192),
        new ProjectInfo("SeamCarver", "An implementation of the seam carving algorithm used to change an image aspect ratio", logo192),
        new ProjectInfo("Simple Raytracer", "A simple raytracing render algorithim", logo192),
        new ProjectInfo("WebGL Demo", "A small interactive WebGL animation from my Graphics class", logo192),
    ]
    
    // TODO Store this in a db or somethin
    let featuredProjectIndex = 0;
    
    return (
        <div>
            {featured
                ? (<ProjectDisplay projectInfo={projectInfos[featuredProjectIndex]} />)
                : projectInfos.map((projectInfo, index) => (
                    <ProjectDisplay projectInfo={projectInfo} index={index} />
            ))}
        </div>
    )
}

interface Props {
    featured: boolean
}

ProjectDisplayContainer.propTypes = {
    featured: PropTypes.bool.isRequired
}

ProjectDisplayContainer.defaultProps = {
    featured: false
}

export default ProjectDisplayContainer;