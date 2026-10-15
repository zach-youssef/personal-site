import React, { useEffect, useState, useLayoutEffect } from 'react'
import { ProjectDisplayCard } from './ProjectDisplay';
import { CardGroup } from 'react-bootstrap';
import { fetchGraphQL } from '../../FetchHelper'
import ProjectInfo from './ProjectInfo';

interface Props {
    category: String
}

function ProjectDisplayContainer({category}: Props){
    const [projectInfos, setProjectInfos] = useState<ProjectInfo[]>([]);

    const [screenSize, setScreenSize] = useState(1024);
    const updateScreenSize = () => setScreenSize(window.innerWidth);
    useLayoutEffect(() => {
        updateScreenSize();
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, []);

    const mediumThreshold = 1100;
    const smallThreshold = 512;
    
    const largeCardsPerRow = 5;
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
            query FetchProjectsQuery($category: ProjectCategory) {
                projectInfos(category: $category) {
                    name,
                    description,
                    id,
                    imagePath
                }
            }
        `, {"category": category}).then(response => {
            if(!isMounted){
                return;
            }
            const data = response.data;
            setProjectInfos(data.projectInfos ?? []);
        }).catch(error => {
            console.error(error);
        });
        
        return () => {
            isMounted = false;
        };
    }

    useEffect(loadProjectInfos, [])
    
    return(
        <div>
            {
                Array.from(Array(Math.ceil(projectInfos.length / cardsPerRow)).keys())
                    .map(row => (
                        <CardGroup key={row}>
                            {
                                projectInfos.slice(row * cardsPerRow, (row * cardsPerRow) + cardsPerRow)
                                    .map((projectInfo, index) => 
                                        <ProjectDisplayCard key={projectInfo.id} projectInfo={projectInfo} index={index}/>)
                            }
                        </CardGroup>
                    ))
            }
        </div>
    )
}

export default ProjectDisplayContainer;