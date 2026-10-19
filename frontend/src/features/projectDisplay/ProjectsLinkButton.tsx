import React from 'react';
import { Button } from 'react-bootstrap';

interface Props {
    children: React.ReactNode
}

// A full-width link to the list of every project
function ProjectsLinkButton({children}: Props) {
    return (
        <Button variant="secondary" href="/projects" block>
            {children}
        </Button>
    );
}

export default ProjectsLinkButton;
