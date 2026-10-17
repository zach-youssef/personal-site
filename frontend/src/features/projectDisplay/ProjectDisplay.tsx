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
                {/* Most cards are below the fold, so they load as they're scrolled to */}
                <Card.Img variant="top" src={imagePath} loading="lazy" decoding="async"/>
            </Card.Body>
            <Card.Body>
                <Card.Text>{description}</Card.Text>
                <Card.Link href={`${url}/${id}`}>View</Card.Link>
            </Card.Body>
        </Card>
    );
}

export function ProjectDisplayFeatured({projectInfo, index}: Props) {
    const { name, description, imagePath, id } = projectInfo;

    let imageCol = (
        <Col>
            <Card.Img src={imagePath} alt={name}/>
        </Col>
    )
    
    let descCol = (
        <Col>
            <Card.Text>{description}</Card.Text>
            {/* The featured card is on the home page, so it links into the projects section */}
            <Card.Link href={`/projects/${id}`}>View</Card.Link>
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
