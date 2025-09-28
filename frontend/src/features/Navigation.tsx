import React from 'react';
import {Navbar, Nav, Row} from 'react-bootstrap';
import {SiteText, SiteTextContents} from '../content/text/SiteText';

function Navigation() {
    const externalLogoHeight = 20;



    return (
        <Navbar bg="primary" variant="dark" expand="lg" fixed='top'>
            <Navbar.Brand href="/">{SiteTextContents[SiteText.HeaderBar]}</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav"/>
            <Navbar.Collapse id="basic-navbar-nav">
                <Nav className="mr-auto">
                    <Nav.Link href="/">Home</Nav.Link>
                    <Nav.Link href="/projects">Projects</Nav.Link>
                </Nav>
            <Row>
                <Nav.Link href="https://github.com/zach-youssef">
                    <img src="/github-mark.svg" height={externalLogoHeight}/>
                </Nav.Link>
                <Nav.Link href="https://www.linkedin.com/in/zachary-youssef-3a9ab012b">
                    <img src="/InBug-Black.png" height={externalLogoHeight}/>
                </Nav.Link>
            </Row>
            </Navbar.Collapse>
        </Navbar>
    );
}

export default Navigation;