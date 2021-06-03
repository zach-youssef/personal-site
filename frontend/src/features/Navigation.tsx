import React from 'react';
import {Navbar, Nav} from 'react-bootstrap';
import {SiteText, SiteTextContents} from '../content/text/SiteText';

function Navigation() {
    return (
    <div>
        <Navbar bg="dark" variant="dark" expand="lg">
            <Navbar.Brand >{SiteTextContents[SiteText.HeaderBar]}</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav"/>
            <Navbar.Collapse id="basic-navbar-nav">
                <Nav className="mr-auto">
                    <Nav.Link>Home</Nav.Link>
                    <Nav.Link>Projects</Nav.Link>
                </Nav>
            </Navbar.Collapse>
        </Navbar>
    </div>
    );
}

export default Navigation;