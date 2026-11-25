import React from 'react';
import ButtonLink from '../ButtonLink';

interface Props {
    children: React.ReactNode
}

// A full-width link to the list of every project
function ProjectsLinkButton({children}: Props) {
    return (
        <ButtonLink variant="secondary" href="/projects" className="d-block w-100">
            {children}
        </ButtonLink>
    );
}

export default ProjectsLinkButton;
