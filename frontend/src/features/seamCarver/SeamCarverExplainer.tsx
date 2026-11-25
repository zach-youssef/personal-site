import React from 'react';
import { SiteText, SiteTextContents } from '../../content/text/SiteText';

// The explanation's sections in page order. The headings are fixed; the copy comes from SiteText.
const SECTIONS: { heading: string, key: SiteText }[] = [
    { heading: 'What is seam carving?', key: SiteText.SeamCarverWhat },
    { heading: 'How it works', key: SiteText.SeamCarverHow },
    { heading: 'This implementation', key: SiteText.SeamCarverThisImplementation },
];

export const PAPER_URL = 'https://doi.org/10.1145/1275808.1276390';

// A section's copy as paragraphs: a blank line starts a new one
const paragraphs = (copy: string) => copy.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

// Explains seam carving with the copy in SiteText: renders each section whose copy isn't empty, then
// the paper; renders nothing while every section is empty.
export default function SeamCarverExplainer() {
    const filled = SECTIONS
        .map(section => ({ ...section, paragraphs: paragraphs(SiteTextContents[section.key]) }))
        .filter(section => section.paragraphs.length > 0);
    if (filled.length === 0) return null;
    return (
        <section aria-label="About seam carving">
            {filled.map(section => (
                <section key={section.key}>
                    <h2>{section.heading}</h2>
                    {section.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </section>
            ))}
            <p>
                Based on Shai Avidan and Ariel Shamir,{' '}
                <a href={PAPER_URL}>
                    “Seam Carving for Content-Aware Image Resizing”
                </a>
                , SIGGRAPH 2007.
            </p>
        </section>
    );
}
