import React from 'react';
import PropTypes from 'prop-types';
import ProjectInfo from './ProjectInfo';
import { Card, Col, Row } from 'react-bootstrap';

export function ProjectDisplayCard({projectInfo, index}: Props) {

    return (
        <Card>
            <Card.Img variant="top" src={projectInfo.getImageFilePath()}/>
            <Card.Title>{projectInfo.getTitle()}</Card.Title>
            <Card.Text>{projectInfo.getDescriptionText()}</Card.Text>
        </Card>
    );
}

export function ProjectDisplayFeatured({projectInfo, index}: Props) {
    let imageCol = (
        <Col>
            <img src={projectInfo.getImageFilePath()} alt={projectInfo.getTitle()}/>
        </Col>
    )
    
    let descCol = (
        <Col>
            <p>{projectInfo.getDescriptionText()}</p>
        </Col>
    )

    return (
        <Card>
            <Card.Header>
                Featured: {projectInfo.getTitle()}
            </Card.Header>
            <Row>
                {descCol}
                {imageCol}
            </Row>
        </Card>
    );
}

interface Props {
    projectInfo: ProjectInfo,
    index: number
}

ProjectDisplayCard.propTypes = {
    projectInfo: PropTypes.instanceOf(ProjectInfo).isRequired,
    index: PropTypes.number.isRequired
}

ProjectDisplayCard.defaultProps = {
    index: 0
}

ProjectDisplayFeatured.propTypes = {
    projectInfo: PropTypes.instanceOf(ProjectInfo).isRequired,
    index: PropTypes.number.isRequired
}

ProjectDisplayFeatured.defaultProps = {
    index: 0
}
