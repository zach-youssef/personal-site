import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProjectWriteupPage from './ProjectWriteupPage';
import { formatArticleDate } from './ArticleCards';
import { PROJECT_WRITEUP_QUERY } from './ProjectWriteup';
import { figureFiles, mockGraphQL, projects, writeupResolvers, writeups } from '../../testUtils/mockGraphQL';
import { parseFigureSvg } from './WriteupFigure';
import { embedUrl } from './WriteupVideo';
import { SiteText, SiteTextContents } from '../../content/text/SiteText';

const failure = SiteTextContents[SiteText.WriteupLoadFailed];
const writeup = writeups.broadAR;

async function renderLoaded() {
    const server = mockGraphQL(writeupResolvers());
    const view = render(<ProjectWriteupPage id="broadAR"/>);
    await screen.findByRole('heading', { level: 2 });
    return { server, ...view };
}

function card(title: string) {
    return screen.getByRole('link', { name: title }).closest('.card') as HTMLElement;
}

describe('ProjectWriteupPage', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('requests the project and its write-up together, by id', async () => {
        const { server } = await renderLoaded();

        expect(server.requests()).toHaveLength(1);
        expect(server.requests()[0].query).toBe(PROJECT_WRITEUP_QUERY);
        expect(server.requests()[0].variables).toEqual({ id: 'broadAR' });
    });

    it("titles the page with the card's name and shows the context", async () => {
        await renderLoaded();

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(projects.broadAR.name);
        expect(screen.getByText(writeup.context)).toHaveClass('text-muted');
    });

    it('shows the sections in order, with a heading only where there is one', async () => {
        const { container } = await renderLoaded();

        const sections = container.querySelectorAll('section');
        expect(sections).toHaveLength(2);
        expect(sections[0].querySelector('h4')).toBeNull();
        expect([...sections[0].querySelectorAll('p')].map(p => p.textContent))
            .toEqual(['First paragraph.', 'Second paragraph.']);
        expect(sections[1].querySelector('h4')).toHaveTextContent('The technical work');
        expect([...sections[1].querySelectorAll('p')].map(p => p.textContent)).toEqual(['Third paragraph.']);
    });

    it("shows the card's image with the write-up's alt text", async () => {
        await renderLoaded();

        const image = screen.getByAltText(writeup.imageAlt);
        expect(image).toHaveAttribute('src', projects.broadAR.imagePath);
        // Near the top of the page, so it loads right away
        expect(image).not.toHaveAttribute('loading');
    });

    it('shows a card per article linking to it, with its source, date and note', async () => {
        await renderLoaded();

        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(SiteTextContents[SiteText.ArticlesHeader]);
        expect(document.querySelectorAll('.article-card')).toHaveLength(writeup.articles.length);
        for (const article of writeup.articles) {
            const link = screen.getByRole('link', { name: article.title });
            expect(link).toHaveAttribute('href', article.url);
            // The whole card is the link, opening in the same tab
            expect(link).toHaveClass('stretched-link');
            expect(link).not.toHaveAttribute('target');
            expect(within(card(article.title)).getByText(article.note)).toBeInTheDocument();
        }
        expect(within(card('An article with a month')).getByText('Studio · September 2024')).toBeInTheDocument();
        expect(within(card('An article with a day')).getByText('Newspaper · September 25, 2024')).toBeInTheDocument();
    });

    it('shows only the source of an undated article', async () => {
        await renderLoaded();

        const subtitle = card('An undated article').querySelector('.card-subtitle');
        expect(subtitle?.textContent).toBe('Blog');
    });

    it('shows no links, and no figures or video, when the write-up has none', async () => {
        const { container } = await renderLoaded();

        expect(container.querySelector('.writeup-links')).toBeNull();
        expect(container.querySelector('figure')).toBeNull();
        expect(container.querySelector('.writeup-video')).toBeNull();
    });

    it('shows the failure line for a project without a write-up', async () => {
        mockGraphQL(writeupResolvers());
        render(<ProjectWriteupPage id="sokoban"/>);

        expect(await screen.findByText(failure)).toBeInTheDocument();
        expect(screen.queryByRole('heading')).toBeNull();
    });

    it('shows the failure line when the request fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        render(<ProjectWriteupPage id="broadAR"/>);

        expect(await screen.findByText(failure)).toBeInTheDocument();
    });

    it('renders nothing while loading', () => {
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
        const { container } = render(<ProjectWriteupPage id="broadAR"/>);

        expect(container).toBeEmptyDOMElement();
    });

    it('does not update its state after unmounting', async () => {
        const errors = vi.spyOn(console, 'error');
        let respond!: (response: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>(resolve => { respond = resolve; }));
        vi.stubGlobal('fetch', fetchMock);
        const { unmount } = render(<ProjectWriteupPage id="broadAR"/>);
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());

        unmount();
        respond({ ok: true, json: async () => ({ data: { projectInfo: projects.broadAR, projectWriteup: writeup } }) } as Response);
        await new Promise(resolve => setTimeout(resolve, 50));

        // React 17 warns on a state update to an unmounted component
        expect(errors).not.toHaveBeenCalled();
    });
});

describe('ProjectWriteupPage with a video, figures and links', () => {
    const fdb = writeups.foundationDbFs;

    async function renderVideoPage(files: Record<string, string> = figureFiles) {
        const server = mockGraphQL(writeupResolvers(), files);
        const view = render(<ProjectWriteupPage id="foundationDbFs"/>);
        await screen.findByRole('heading', { level: 2 });
        return { server, ...view };
    }

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("shows a poster in the image's place, and no player until it's clicked", async () => {
        const { container } = await renderVideoPage();

        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('iframe')).toBeNull();
        const poster = screen.getByRole('button', { name: `${SiteTextContents[SiteText.PlayVideo]}: ${fdb.video.title}` });
        expect(poster).toHaveTextContent(fdb.video.title);
        expect(poster).toHaveTextContent(SiteTextContents[SiteText.VideoLoadsFromYouTube]);

        fireEvent.click(poster);

        const player = screen.getByTitle(fdb.video.title);
        expect(player.tagName).toBe('IFRAME');
        expect(player).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/Q0pc37MOsxI?autoplay=1');
        expect(player).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        expect(player).toHaveFocus();
        expect(screen.queryByRole('button', { name: /Play video/ })).toBeNull();
    });

    it("draws each figure's SVG inline, named by its alt text, with its caption", async () => {
        const { container } = await renderVideoPage();

        const figures = container.querySelectorAll('section figure');
        expect(figures).toHaveLength(2);
        // After the section's paragraphs
        expect(container.querySelector('section p + figure')).toBe(figures[0]);
        const svg = await within(figures[0] as HTMLElement).findByRole('img', { name: 'Boxes and arrows' });
        expect(svg.tagName.toLowerCase()).toBe('svg');
        // Its text is in the page, where the theme's classes reach it and it can be selected
        expect(svg.querySelector('text.wd-text')).toHaveTextContent('FUSE');
        expect(figures[0].querySelector('figcaption')).toHaveTextContent('The first diagram');
        expect(await within(figures[1] as HTMLElement).findByRole('img', { name: 'Keys and values' })).toHaveTextContent('(alpha, MODE)');
    });

    it("drops the SVG's scripts, event handlers and javascript: links, and its fixed size", async () => {
        const { container } = await renderVideoPage();

        const svg = await within(container.querySelector('figure') as HTMLElement).findByRole('img');
        expect(svg.querySelector('script')).toBeNull();
        expect(svg.querySelector('[onclick]')).toBeNull();
        expect(svg.querySelector('a')?.getAttribute('href')).toBeNull();
        expect(svg.querySelector('title')).toBeNull();
        expect(svg).not.toHaveAttribute('width');
        expect(svg).not.toHaveAttribute('height');
        expect(svg).toHaveAttribute('viewBox', '0 0 100 50');
    });

    it("shows a figure's alt text when its SVG can't be loaded", async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { container } = await renderVideoPage({ '/assets/writeups/foundationDbFs/two.svg': '<html><body>Not found</body></html>' });

        const figures = container.querySelectorAll('figure');
        expect(await within(figures[0] as HTMLElement).findByText('Boxes and arrows')).toHaveClass('text-muted');
        expect(await within(figures[1] as HTMLElement).findByText('Keys and values')).toHaveClass('text-muted');
        expect(container.querySelector('figure svg')).toBeNull();
        expect(figures[0].querySelector('figcaption')).toHaveTextContent('The first diagram');
    });

    it('shows the links as buttons, and no articles heading without articles', async () => {
        await renderVideoPage();

        for (const link of fdb.links) {
            expect(screen.getByRole('link', { name: link.title })).toHaveAttribute('href', link.url);
        }
        expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
        expect(document.querySelector('.article-card')).toBeNull();
    });
});

describe('parseFigureSvg', () => {
    it('refuses what is not an SVG document', () => {
        expect(parseFigureSvg('<html><body/></html>', 'x')).toBeNull();
        expect(parseFigureSvg('<svg xmlns="http://www.w3.org/2000/svg"><unclosed></svg>', 'x')).toBeNull();
        expect(parseFigureSvg('<svg><text>no namespace</text></svg>', 'x')).toBeNull();
        expect(parseFigureSvg('not markup', 'x')).toBeNull();
    });

    it('drops stylesheets, animations and references to other documents', () => {
        const svg = parseFigureSvg(
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1 1">' +
            '<style>body { display: none }</style>' +
            '<defs><g id="a"/></defs>' +
            '<a href="https://example.com/"><animate attributeName="href" to="javascript:alert(1)"/><set attributeName="href" to="x"/>' +
            '<animateTransform attributeName="transform"/><animateMotion/><text>kept</text></a>' +
            '<use id="u1" href="#a"/><use id="u2" href="https://example.com/a.svg#a"/><use id="u3" xlink:href="other.svg#a"/>' +
            '<image id="i1" href="https://example.com/a.png"/><image id="i2" xlink:href="#a"/><use id="u4" href="#"/>' +
            '</svg>', 'x')!;

        for (const name of ['style', 'animate', 'set', 'animateTransform', 'animateMotion']) {
            expect(svg.querySelector(name)).toBeNull();
        }
        expect(svg.querySelector('text')?.textContent).toBe('kept');
        expect(svg.querySelector('a')?.getAttribute('href')).toBe('https://example.com/');
        expect(svg.querySelector('#u1')?.getAttribute('href')).toBe('#a');
        expect(svg.querySelector('#i2')?.getAttribute('xlink:href')).toBe('#a');
        expect(svg.querySelector('#u2')?.getAttribute('href')).toBeNull();
        expect(svg.querySelector('#u3')?.getAttribute('xlink:href')).toBeNull();
        expect(svg.querySelector('#i1')?.getAttribute('href')).toBeNull();
        expect(svg.querySelector('#u4')?.getAttribute('href')).toBeNull();
    });
});

describe('embedUrl', () => {
    it("is youtube-nocookie.com's player for the id, autoplaying", () => {
        expect(embedUrl('Q0pc37MOsxI')).toBe('https://www.youtube-nocookie.com/embed/Q0pc37MOsxI?autoplay=1');
    });
});

describe('formatArticleDate', () => {
    const originalTZ = process.env.TZ;
    afterEach(() => {
        process.env.TZ = originalTZ;
    });

    it.each(['America/Los_Angeles', 'Pacific/Honolulu', 'UTC', 'Asia/Tokyo', 'Pacific/Kiritimati'])(
        'keeps the month and day in %s',
        tz => {
            process.env.TZ = tz;
            expect(formatArticleDate('2024-09')).toBe('September 2024');
            expect(formatArticleDate('2024-09-01')).toBe('September 1, 2024');
            expect(formatArticleDate('2024-01')).toBe('January 2024');
        });
});
