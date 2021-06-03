import React from 'react';
import Navigation from './features/Navigation'
import './App.css';
import { Jumbotron, Container, Row } from 'react-bootstrap';
import {SiteText, SiteTextContents} from './content/text/SiteText'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <Navigation />
        <Container fluid>
          <Row>
            <Jumbotron>
              <h1>{SiteTextContents[SiteText.AboutMeHeader]}</h1>
              <p> {SiteTextContents[SiteText.AboutDesc]} </p>
            </Jumbotron>
          </Row>
        </Container>
      </header>
    </div>
  );
}

export default App;
