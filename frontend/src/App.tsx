import React from 'react';
import {BrowserRouter as Router, Switch, Route} from 'react-router-dom';
import Navigation from './features/Navigation';
import './App.css';
import { Container } from 'react-bootstrap';
import ProjectDisplayContainer from './features/projectDisplay/ProjectDisplayContainer';
import Home from './features/Home';
import ProjectsPage from './features/projectDisplay/ProjectsPage';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <Navigation />
        </header>
        <body>
          <Container fluid>
            <Switch>
              <Route path="/projects">
                <ProjectsPage />
              </Route>
              <Route path="/">
                <Home />
              </Route>
            </Switch>
          </Container>
        </body>
      </div>
    </Router>
  );
}

export default App;
