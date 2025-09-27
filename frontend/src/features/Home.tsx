import React, { useEffect, useState } from 'react';
import { Row, Container } from 'react-bootstrap';
import { SiteTextContents, SiteText } from '../content/text/SiteText';
import { ProjectDisplayFeatured } from './projectDisplay/ProjectDisplay';
import { fetchGraphQL } from '../FetchHelper';

function Home() {
    const [featuredProject, setFeaturedProject] = useState(null)
    
    function loadFeaturedProject() {
      let isMounted = true;
      fetchGraphQL(`
        query FetchFeaturedProjectsQuery {
          projectInfos(featured: true) {
            name,
            description,
            id,
            imagePath
          }
        }
      `, {}).then(response => {
        if(!isMounted) {
          return;
        }
        const data = response.data;
        setFeaturedProject(data.projectInfos[0]);
      }).catch(error => {
        console.error(error);
      });
      
      return() => {
        isMounted = false;
      };
    }

    useEffect(loadFeaturedProject, []);
    
    if (featuredProject === null || featuredProject === undefined){
      loadFeaturedProject()
    }

    return (
        <Container >
          <Row>
              <h2>{SiteTextContents[SiteText.AboutMeHeader]}</h2>
          </Row>
          <Row>
            <p>
              {SiteTextContents[SiteText.AboutDesc].split("\n").map(line => 
                <div>{line}</div>
              )}
            </p>
          </Row>
          <Row>
            {
              featuredProject != null ?  <ProjectDisplayFeatured projectInfo={featuredProject!!}/> : <div />
            }
          </Row>
        </Container>
    );
}

export default Home;