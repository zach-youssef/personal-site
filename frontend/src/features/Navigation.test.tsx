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

    it('links to external profiles by name', () => {
        render(<Navigation />);

        expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/zach-youssef');
        expect(screen.getByRole('link', { name: 'LinkedIn' }))
            .toHaveAttribute('href', 'https://www.linkedin.com/in/zach-youssef-3a9ab012b');
    });
});
