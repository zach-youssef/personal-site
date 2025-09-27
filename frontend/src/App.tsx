import React from 'react';
import {BrowserRouter as Router, Switch, Route} from 'react-router-dom';
import Navigation from './features/Navigation';
import './App.css';
import { Container } from 'react-bootstrap';
import Home from './features/Home';
import ProjectsPage from './features/projectDisplay/ProjectsPage';

function App() {
  return (
    <Router>
          <Navigation />
          <Container >
            <Switch>
              <Route path="/projects">
                <ProjectsPage />
              </Route>
              <Route path="/">
                <Home />
              </Route>
            </Switch>
          </Container>
    </Router>
  );
}

export default App;
