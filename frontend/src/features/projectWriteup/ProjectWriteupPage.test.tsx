import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ProjectWriteupPage from './ProjectWriteupPage';
import { formatArticleDate } from './ArticleCards';
import { PROJECT_WRITEUP_QUERY } from './ProjectWriteup';
import { mockGraphQL, projects, writeupResolvers, writeups } from '../../testUtils/mockGraphQL';
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
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

        unmount();
        respond({ ok: true, json: async () => ({ data: { projectInfo: projects.broadAR, projectWriteup: writeup } }) } as Response);
        await new Promise(resolve => setTimeout(resolve, 50));

        // React 17 warns on a state update to an unmounted component
        expect(errors).not.toHaveBeenCalled();
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
