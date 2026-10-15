import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Navigation from './Navigation';

describe('Navigation', () => {
    it('links to the site sections', () => {
        render(<Navigation />);

        expect(screen.getByText("Zach's Personal Website").closest('a')).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    });

    it('links to external profiles', () => {
        const { container } = render(<Navigation />);

        const hrefs = Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href'));
        expect(hrefs).toContain('https://github.com/zach-youssef');
        expect(hrefs).toContain('https://www.linkedin.com/in/zach-youssef-3a9ab012b');
    });
});
