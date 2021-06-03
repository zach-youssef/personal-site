import React from 'react';
import { Row, Jumbotron } from 'react-bootstrap';
import { SiteTextContents, SiteText } from '../content/text/SiteText';
import ProjectInfo from './projectDisplay/ProjectInfo';
import { ProjectDisplayFeatured } from './projectDisplay/ProjectDisplay';
import logo192 from '../logo192.png';

function Home() {
    // TODO For the love of god load this from somewhere
    let featured = new ProjectInfo("Sokoban AI", "An A* and Q learning implementation to solve the game Sokoban", logo192)

    return (
        <div>
          <Row>
            <Jumbotron>
              <h1>{SiteTextContents[SiteText.AboutMeHeader]}</h1>
              <p> {SiteTextContents[SiteText.AboutDesc]} </p>
            </Jumbotron>
          </Row>
          <ProjectDisplayFeatured projectInfo={featured}/>
        </div>
    );
}

export default Home;