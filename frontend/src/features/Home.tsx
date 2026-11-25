import React, { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { SiteTextContents, SiteText } from '../content/text/SiteText';
import { ProjectDisplayFeatured } from './projectDisplay/ProjectDisplay';
import ProjectInfo from './projectDisplay/ProjectInfo';
import ProjectsLinkButton from './projectDisplay/ProjectsLinkButton';
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

    // The sections reach the edges of the page's container, without a gutter of their own
    return (
        <Container className="px-0">
          <div className="d-flex flex-wrap">
              <h2>{SiteTextContents[SiteText.AboutMeHeader]}</h2>
          </div>
          <div className="d-flex flex-wrap">
            <p>
              {SiteTextContents[SiteText.AboutDesc].split("\n").map((line, index) =>
                <React.Fragment key={index}>
                  {index > 0 && <br/>}
                  {line}
                </React.Fragment>
              )}
            </p>
          </div>
          {featuredProjects.length > 0 &&
            <>
              <div className="d-flex flex-wrap">
                <h2>{SiteTextContents[SiteText.FeaturedProjectHeader]}</h2>
              </div>
              <div className="d-flex flex-wrap">
                <div className="featured-projects">
                  {featuredProjects.map((projectInfo, index) =>
                    <ProjectDisplayFeatured key={projectInfo.id} projectInfo={projectInfo} index={index}/>
                  )}
                  <ProjectsLinkButton>
                    {SiteTextContents[SiteText.SeeMoreProjects]}
                  </ProjectsLinkButton>
                </div>
              </div>
            </>
          }
        </Container>
    );
}

export default Home;