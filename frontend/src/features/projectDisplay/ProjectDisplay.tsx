import React from 'react';
import PropTypes from 'prop-types';
import ProjectInfo from './ProjectInfo';
import { Card, Col, Row } from 'react-bootstrap';

export function ProjectDisplayCard({projectInfo, index}: Props) {
    const {title, description, imagePath} = projectInfo;

    return (
        <Card>
            <Card.Img variant="top" src={imagePath}/>
            <Card.Title>{title}</Card.Title>
            <Card.Text>{description}</Card.Text>
        </Card>
    );
}

export function ProjectDisplayFeatured({projectInfo, index}: Props) {
    const {title, description, imagePath} = projectInfo;

    let imageCol = (
        <Col>
            <img src={imagePath} alt={title}/>
        </Col>
    )
    
    let descCol = (
        <Col>
            <p>{description}</p>
        </Col>
    )

    return (
        <Card>
            <Card.Header>
                Featured: {title}
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

ProjectDisplayCard.defaultProps = {
    index: 0
}

ProjectDisplayFeatured.defaultProps = {
    index: 0
}
