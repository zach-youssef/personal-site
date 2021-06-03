import React from 'react';
import {
    BrowserRouter as Router,
    Switch,
    Route,
    useRouteMatch
} from 'react-router-dom';
import { SiteText, SiteTextContents } from '../../content/text/SiteText';
import ProjectDisplayContainer from './ProjectDisplayContainer';

function ProjectsPage() {
    let match = useRouteMatch();

    return(
        <Router>
            <Switch>
                <Route path={`${match.path}/sokoban`}>
                    <div>
                        Sokoban Coming soon!
                    </div>
                </Route>
                <Route path={`${match.path}/raytracer`}>
                    <div>
                        Raytracer Coming soon!
                    </div>
                </Route>
                <Route path={`${match.path}/seamCarver`}>
                    <div>
                        Seam Carver Coming soon!
                    </div>
                </Route>
                <Route path={`${match.path}/webglDemo`}>
                    <div>
                        WebGL Demo Coming soon!
                    </div>
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