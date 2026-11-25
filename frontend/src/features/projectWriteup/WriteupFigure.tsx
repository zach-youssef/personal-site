import React, { useEffect, useRef, useState } from 'react';
import { WriteupFigure as Figure } from './ProjectWriteup';

// Elements and attributes an inlined SVG mustn't bring into the page: scripts, foreign HTML,
// event handlers, javascript: links, stylesheets (which would reach the whole page), animations
// (which could set an href) and references to other documents from <use> and <image>. The SVGs are
// the site's own, so this is a safeguard.
const UNSAFE_ELEMENTS = 'script, foreignObject, iframe, object, embed, style, animate, animateTransform, animateMotion, set';

// `text` as an <svg> element ready to put in the page, or null if it isn't an SVG document
export function parseFigureSvg(text: string, alt: string): SVGSVGElement | null {
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = parsed.documentElement;
    if (svg.nodeName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg' || parsed.querySelector('parsererror')) {
        return null;
    }
    svg.querySelectorAll(UNSAFE_ELEMENTS).forEach(element => element.remove());
    for (const element of [svg, ...svg.querySelectorAll('*')]) {
        for (const attribute of [...element.attributes]) {
            const name = attribute.name.toLowerCase();
            const isHref = name === 'href' || name === 'xlink:href';
            const isExternalReference = isHref && ['use', 'image'].includes(element.localName) && !/^\s*#./.test(attribute.value);
            if (name.startsWith('on') || (name.endsWith('href') && /^\s*javascript:/i.test(attribute.value)) || isExternalReference) {
                element.removeAttribute(attribute.name);
            }
        }
    }
    // One image to screen readers, named by the alt text; its text can still be selected
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', alt);
    svg.querySelector('title')?.remove();
    // Scales to the column, by its viewBox
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    return svg as unknown as SVGSVGElement;
}

type Load = 'loading' | 'loaded' | 'failed';

// A write-up's diagram with its caption. The SVG is fetched and put in the page itself rather than
// shown with <img>, so that the site's stylesheet colours it for the current theme (by the classes
// in "Write-up diagrams" in the README) and its text can be selected and searched.
function WriteupFigure({ figure }: { figure: Figure }) {
    const holder = useRef<HTMLDivElement>(null);
    const [load, setLoad] = useState<Load>('loading');

    useEffect(() => {
        let isMounted = true;
        setLoad('loading');
        fetch(figure.src)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`${figure.src}: ${response.status}`);
                }
                return response.text();
            })
            .then(text => {
                if (!isMounted) {
                    return;
                }
                const svg = parseFigureSvg(text, figure.alt);
                if (!svg || !holder.current) {
                    throw new Error(`${figure.src}: not an SVG`);
                }
                holder.current.replaceChildren(document.importNode(svg, true));
                setLoad('loaded');
            })
            .catch(error => {
                console.error(error);
                if (isMounted) {
                    setLoad('failed');
                }
            });
        return () => {
            isMounted = false;
        };
    }, [figure.src, figure.alt]);

    return (
        <figure className="writeup-figure">
            <div ref={holder} className="writeup-figure-svg"/>
            {/* If the diagram can't be shown, what it shows */}
            {load === 'failed' && <p className="text-muted">{figure.alt}</p>}
            <figcaption className="text-muted">{figure.caption}</figcaption>
        </figure>
    );
}

export default WriteupFigure;
