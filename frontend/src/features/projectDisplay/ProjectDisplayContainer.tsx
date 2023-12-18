import React, { useEffect, useState, useLayoutEffect } from 'react'
import { ProjectDisplayCard } from './ProjectDisplay';
import { CardGroup } from 'react-bootstrap';
import { fetchGraphQL } from '../../FetchHelper'

function ProjectDisplayContainer(){
    const [projectInfos, setProjectInfos] = useState([]);

    const [screenSize, setScreenSize] = useState(1024);
    const updateScreenSize = () => setScreenSize(window.innerWidth);
    useLayoutEffect(() => {
        updateScreenSize();
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, []);

    const mediumThreshold = 1100;
    const smallThreshold = 512;
    
    const largeCardsPerRow = 4;
    const mediumCardsPerRow = 2;
    const smallCardPerRow = 1;

    let cardsPerRow = screenSize > mediumThreshold
        ? largeCardsPerRow 
        : screenSize > smallThreshold 
            ? mediumCardsPerRow 
            : smallCardPerRow;

    function loadProjectInfos() {
        let isMounted = true;
        fetchGraphQL(`
            query FetchProjectsQuery {
                projectInfos {
                    name,
                    description,
                    id,
                    imagePath
                }
            }
        `, {}).then(response => {
            if(!isMounted){
                return;
            }
            const data = response.data;
            setProjectInfos(data.projectInfos);
        }).catch(error => {
            console.error(error);
        });
        
        return () => {
            isMounted = false;
        };
    }

    useEffect(loadProjectInfos, [])
    
    if (projectInfos === null || projectInfos === undefined) {
        loadProjectInfos()
        return <div/>
    }
    
    return(
        <div>
            {
                Array.from(Array(Math.ceil(projectInfos.length / cardsPerRow)).keys())
                    .map(row => (
                        <CardGroup>
                            {
                                projectInfos.slice(row * cardsPerRow, (row * cardsPerRow) + cardsPerRow)
                                    .map((projectInfo, index) => 
                                        <ProjectDisplayCard projectInfo={projectInfo} index={index}/>)
                            }
                        </CardGroup>
                    ))
            }
        </div>
    )
}

export default ProjectDisplayContainer;