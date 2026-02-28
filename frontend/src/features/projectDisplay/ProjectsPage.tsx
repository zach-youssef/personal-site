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
import { Container, Row } from 'react-bootstrap';

function ProjectsPage() {
    let match = useRouteMatch();

    let categoryLabels = [
        ["PROFESSIONAL", SiteTextContents[SiteText.WorkHeader]],
        ["UNIVERSITY", SiteTextContents[SiteText.ProjectHeader]],
    ];

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
                <Route path={`${match.path}/foundationDbFs`} component={ () => { 
                    window.location.href="https://github.com/zach-youssef/foundationdb-fs";
                    return null;
                }}/>
                <Route path={match.path}>
                    <Container>
                        {
                            categoryLabels.map(entry => (
                                <div>
                                    <Row>
                                        <p>
                                            <h2>{entry[1]}</h2>
                                        </p>
                                    </Row>
                                    <Row>
                                        <ProjectDisplayContainer category={entry[0]}/>
                                    </Row>
                                </div>
                            ))
                        }
                    </Container>
                </Route>
            </Switch>
        </Router>
    );
}

export default ProjectsPage;