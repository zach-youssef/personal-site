import React from 'react';
import ProjectInfo from './ProjectInfo';
import { Card, Col, Row } from 'react-bootstrap';
import { useRouteMatch } from 'react-router-dom';

export function ProjectDisplayCard({projectInfo, index}: Props) {
    const {name, description, imagePath, id} = projectInfo;
    
    let url = useRouteMatch().url;

    return (
        <Card>
            <Card.Img variant="top" src={imagePath}/>
            <Card.Title>{name}</Card.Title>
            <Card.Text>{description}</Card.Text>
            <Card.Link href={`${url}/${id}`}>View</Card.Link>
        </Card>
    );
}

export function ProjectDisplayFeatured({projectInfo, index}: Props) {
    const { name, description, imagePath } = projectInfo;

    let imageCol = (
        <Col>
            <img src={imagePath} alt={name}/>
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
                Featured: {name}
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
