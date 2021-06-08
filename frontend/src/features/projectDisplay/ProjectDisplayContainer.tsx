import React, { useEffect, useState } from 'react'
import { ProjectDisplayCard } from './ProjectDisplay';
import { CardGroup } from 'react-bootstrap';
import { fetchGraphQL } from '../../FetchHelper'

function ProjectDisplayContainer(){
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

    useEffect(loadProjectInfos, [fetchGraphQL])
    
    if (projectInfos === null || projectInfos === undefined) {
        loadProjectInfos()
        return <div/>
    }
    
    return(
        <CardGroup>
            {projectInfos.map((projectInfo, index) => <ProjectDisplayCard projectInfo={projectInfo} index={0} />)}
        </CardGroup>
    )
}

export default ProjectDisplayContainer;