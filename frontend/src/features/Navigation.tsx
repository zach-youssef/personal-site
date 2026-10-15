import React from 'react';
import {Navbar, Nav, Row} from 'react-bootstrap';
import {SiteText, SiteTextContents} from '../content/text/SiteText';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../theme/themeContext';

function Navigation() {
    const { theme } = useTheme();

    // The theme toggle stays in the bar beside the menu button on small screens,
    // and moves after the links once the menu is expanded inline
    return (
        <Navbar bg="primary" variant={theme} expand="lg" fixed='top'>
            <Navbar.Brand href="/">{SiteTextContents[SiteText.HeaderBar]}</Navbar.Brand>
            <ThemeToggle className="order-1 order-lg-2 ml-auto ml-lg-3"/>
            <Navbar.Toggle className="order-2 ml-2" aria-controls="basic-navbar-nav"/>
            <Navbar.Collapse className="order-3 order-lg-1" id="basic-navbar-nav">
                <Nav className="mr-auto">
                    <Nav.Link href="/">Home</Nav.Link>
                    <Nav.Link href="/projects">Projects</Nav.Link>
                </Nav>
            <Row>
                <Nav.Link href="https://github.com/zach-youssef">
                    <span className="brand-logo brand-logo-github" role="img" aria-label="GitHub"/>
                </Nav.Link>
                <Nav.Link href="https://www.linkedin.com/in/zach-youssef-3a9ab012b">
                    <span className="brand-logo brand-logo-linkedin" role="img" aria-label="LinkedIn"/>
                </Nav.Link>
            </Row>
            </Navbar.Collapse>
        </Navbar>
    );
}

export default Navigation;