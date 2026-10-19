import React, { useEffect, useState } from 'react';
import { Row, Container, Button } from 'react-bootstrap';
import { SiteTextContents, SiteText } from '../content/text/SiteText';
import { ProjectDisplayFeatured } from './projectDisplay/ProjectDisplay';
import ProjectInfo from './projectDisplay/ProjectInfo';
import { fetchGraphQL } from '../FetchHelper';

function Home() {
    const [featuredProjects, setFeaturedProjects] = useState<ProjectInfo[]>([]);
    
    function loadFeaturedProjects() {
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
        setFeaturedProjects(data.projectInfos ?? []);
      }).catch(error => {
        console.error(error);
      });
      
      return() => {
        isMounted = false;
      };
    }

    useEffect(loadFeaturedProjects, []);

    return (
        <Container >
          <Row>
              <h2>{SiteTextContents[SiteText.AboutMeHeader]}</h2>
          </Row>
          <Row>
            <p>
              {SiteTextContents[SiteText.AboutDesc].split("\n").map((line, index) =>
                <React.Fragment key={index}>
                  {index > 0 && <br/>}
                  {line}
                </React.Fragment>
              )}
            </p>
          </Row>
          {featuredProjects.length > 0 &&
            <>
              <Row>
                <h2>{SiteTextContents[SiteText.FeaturedProjectHeader]}</h2>
              </Row>
              <Row>
                <div className="featured-projects">
                  {featuredProjects.map((projectInfo, index) =>
                    <ProjectDisplayFeatured key={projectInfo.id} projectInfo={projectInfo} index={index}/>
                  )}
                  <Button variant="secondary" href="/projects" block>
                    {SiteTextContents[SiteText.SeeMoreProjects]}
                  </Button>
                </div>
              </Row>
            </>
          }
        </Container>
    );
}

export default Home;