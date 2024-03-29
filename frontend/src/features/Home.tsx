import React, { useEffect, useState } from 'react';
import { Row, Jumbotron } from 'react-bootstrap';
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
        <div>
          <Row>
            <Jumbotron>
              <h2>{SiteTextContents[SiteText.AboutMeHeader]}</h2>
              {SiteTextContents[SiteText.AboutDesc].split("\n").map(line => 
                <p>{line}</p>
              )}
            </Jumbotron>
          </Row>
          {
            featuredProject != null ?  <ProjectDisplayFeatured projectInfo={featuredProject!!}/> : <div />
          }
        </div>
    );
}

export default Home;