import React, { useEffect, useState } from 'react'
import { ProjectDisplayCard } from './ProjectDisplay';
import { CardGroup } from 'react-bootstrap';
import { fetchGraphQL } from '../../FetchHelper'

function ProjectDisplayContainer(){
    
    const cardsPerRow = 2;

    const [projectInfos, setProjectInfos] = useState([]);
    
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