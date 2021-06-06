import React, { useEffect, useState } from 'react'
import { ProjectDisplayCard } from './ProjectDisplay';
import logo192 from '../../logo192.png';
import { CardGroup } from 'react-bootstrap';
import { fetchGraphQL } from '../../FetchHelper'
import ProjectInfo from './ProjectInfo';

function ProjectDisplayContainer(){
    const [projectInfos, setProjectInfos] = useState([]);

    useEffect(() => {
        let isMounted = true;
        fetchGraphQL(`
            query FetchProjectsQuery {
                projectInfos {
                    name,
                    description,
                    id
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
    }, [fetchGraphQL])
    
    return(
        <CardGroup>
            {projectInfos.map((projectInfo, index) => <ProjectDisplayCard projectInfo={projectInfo} index={0} />)}
        </CardGroup>
    )
}

export default ProjectDisplayContainer;