import React from 'react';
import {Navbar, Nav, Container} from 'react-bootstrap';
import {SiteText, SiteTextContents} from '../content/text/SiteText';

function Navigation() {
    return (
    <Navbar bg="primary" variant="dark" expand="lg" fixed='top'>
        <Navbar.Brand href="/">{SiteTextContents[SiteText.HeaderBar]}</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav"/>
        <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mr-auto">
                <Nav.Link href="/">Home</Nav.Link>
                <Nav.Link href="/projects">Projects</Nav.Link>
            </Nav>
        </Navbar.Collapse>
    </Navbar>
    );
}

export default Navigation;