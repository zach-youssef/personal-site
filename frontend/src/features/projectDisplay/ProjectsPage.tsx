import React from 'react';
import {
    BrowserRouter as Router,
    Switch,
    Route,
    useRouteMatch
} from 'react-router-dom';
import { SiteText, SiteTextContents } from '../../content/text/SiteText';
import ProjectDisplayContainer from './ProjectDisplayContainer';
import SokobanPage from '../sokoban/SokobanPage';
import SeamCarverPage from '../seamCarver/SeamCarverPage';
import WebGLDemoPage from '../webgl/WebGLDemoPage';
import RaytracerPage from '../raytracer/RaytracerPage';

function ProjectsPage() {
    let match = useRouteMatch();

    return(
        <Router>
            <Switch>
                <Route path={`${match.path}/sokoban`}>
                    <SokobanPage />
                </Route>
                <Route path={`${match.path}/raytracer`}>
                    <RaytracerPage />
                </Route>
                <Route path={`${match.path}/seamCarver`}>
                    <SeamCarverPage />
                </Route>
                <Route path={`${match.path}/webglDemo`}>
                    <WebGLDemoPage />
                </Route>
                <Route path={match.path}>
                    <h1>{SiteTextContents[SiteText.ProjectHeader]}</h1>
                    <ProjectDisplayContainer />
                </Route>
            </Switch>
        </Router>
    );
}

export default ProjectsPage;