import React from 'react';
import { Row, Jumbotron } from 'react-bootstrap';
import { SiteTextContents, SiteText } from '../content/text/SiteText';
import ProjectDisplayContainer from './projectDisplay/ProjectDisplayContainer';

function Home() {
    return (
    <div>
      <Row>
        <Jumbotron>
          <h1>{SiteTextContents[SiteText.AboutMeHeader]}</h1>
          <p> {SiteTextContents[SiteText.AboutDesc]} </p>
        </Jumbotron>
      </Row>
      <Row>
          <h1>{SiteTextContents[SiteText.FeaturedProjectHeader]}</h1>
      </Row>
      <Row>
        <ProjectDisplayContainer featured/>
      </Row>
    </div>
    );
}

export default Home;