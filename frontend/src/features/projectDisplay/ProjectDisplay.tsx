import React from 'react';
import ProjectInfo from './ProjectInfo';
import { Card, Col, Row, Image } from 'react-bootstrap';
import { useRouteMatch } from 'react-router-dom';

export function ProjectDisplayCard({projectInfo, index}: Props) {
    const {name, description, imagePath, id} = projectInfo;
    
    let url = useRouteMatch().url;

    return (
        <Card>
            <Card.Header>
                <Card.Title>{name}</Card.Title>
            </Card.Header>
            <Card.Body>
                <Card.Img variant="top" src={imagePath}/>
            </Card.Body>
            <Card.Body>
                <Card.Text>{description}</Card.Text>
                <Card.Link href={`${url}/${id}`}>View</Card.Link>
            </Card.Body>
        </Card>
    );
}

export function ProjectDisplayFeatured({projectInfo, index}: Props) {
    const { name, description, imagePath } = projectInfo;

    let imageCol = (
        <Col>
            <Card.Img src={imagePath} alt={name}/>
        </Col>
    )
    
    let descCol = (
        <Col>
            <Card.Text>{description}</Card.Text>
        </Col>
    )

    return (
        <Card>
            <Card.Header>
                Featured: {name}
            </Card.Header>
            <Card.Body>
                <Row>
                    {descCol}
                    {imageCol}
                </Row>
            </Card.Body>
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
