import React from 'react';
import PropTypes from 'prop-types';
import ProjectInfo from './ProjectInfo';
import { Card, Col, Row } from 'react-bootstrap';

function ProjectDisplay({projectInfo, index}: Props) {
    let imageCol = (
        <Col>
            <img src={projectInfo.getImageFilePath()} alt={projectInfo.getTitle()}/>
        </Col>
    )
    
    let descCol = (
        <Col>
            <h2>{projectInfo.getTitle()}</h2>
            <p>{projectInfo.getDescriptionText()}</p>
        </Col>
    )

    return (
        <Card>
            <Row>
                {index % 2 === 0? imageCol : descCol}
                {index % 2 === 0? descCol : imageCol}
            </Row>
        </Card>
    );
}

interface Props {
    projectInfo: ProjectInfo,
    index: number
}

ProjectDisplay.propTypes = {
    projectInfo: PropTypes.instanceOf(ProjectInfo).isRequired,
    index: PropTypes.number.isRequired
}

ProjectDisplay.defaultProps = {
    index: 0
}

export default ProjectDisplay;