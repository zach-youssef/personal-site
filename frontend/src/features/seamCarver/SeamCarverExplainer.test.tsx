import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SiteText, SiteTextContents } from '../../content/text/SiteText';
import SeamCarverExplainer, { PAPER_URL } from './SeamCarverExplainer';

const KEYS = [SiteText.SeamCarverWhat, SiteText.SeamCarverHow, SiteText.SeamCarverThisImplementation];
const original = KEYS.map(key => SiteTextContents[key]);

afterEach(() => {
    cleanup();
    KEYS.forEach((key, i) => { SiteTextContents[key] = original[i]; });
});

const setCopy = (what: string, how: string, mine: string) => {
    [what, how, mine].forEach((copy, i) => { SiteTextContents[KEYS[i]] = copy; });
};

describe('SeamCarverExplainer', () => {
    it('ships with empty sections, so it renders nothing until the copy is written', () => {
        expect(original).toEqual(['', '', '']);
        const { container } = render(<SeamCarverExplainer/>);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing while every section is blank', () => {
        setCopy('', '  \n\n ', '\n');
        const { container } = render(<SeamCarverExplainer/>);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders only the filled section, with its heading, text and the paper link', () => {
        setCopy('', 'Remove the lowest-energy seam, one row at a time.', '');
        render(<SeamCarverExplainer/>);

        expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['How it works']);
        // The seam carver page has no other headings, so the sections start at level 2
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('How it works');
        expect(screen.getByText('Remove the lowest-energy seam, one row at a time.')).toBeInTheDocument();
        const link = screen.getByRole('link', { name: /Seam Carving for Content-Aware Image Resizing/ });
        expect(link).toHaveAttribute('href', PAPER_URL);
        expect(link).not.toHaveAttribute('target');
        expect(screen.getByText(/Avidan and Ariel Shamir/)).toHaveTextContent('SIGGRAPH 2007');
    });

    it('renders the sections in page order and splits paragraphs on blank lines', () => {
        setCopy('First.\n\nSecond.', 'How.', 'Mine.');
        render(<SeamCarverExplainer/>);

        expect(screen.getAllByRole('heading').map(h => h.textContent))
            .toEqual(['What is seam carving?', 'How it works', 'This implementation']);
        expect(screen.getByText('First.').tagName).toBe('P');
        expect(screen.getByText('Second.').tagName).toBe('P');
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });
});
