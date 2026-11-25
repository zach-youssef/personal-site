import { vi } from 'vitest';

type Variables = Record<string, any>;
type Resolver = (variables: Variables) => unknown;

export interface GraphQLRequest {
    url: string,
    query: string,
    variables: Variables,
}

// Replaces fetch with a fake GraphQL server. Each resolver is keyed by a root field name
// and answers any request whose query mentions that field.
export function mockGraphQL(resolvers: Record<string, Resolver>) {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const { query, variables } = JSON.parse(String(init?.body));
        const data: Record<string, unknown> = {};
        for (const [field, resolve] of Object.entries(resolvers)) {
            if (new RegExp(`\\b${field}\\b`).test(query)) {
                data[field] = resolve(variables ?? {});
            }
        }
        return {
            ok: true,
            json: async () => ({ data }),
        } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    return {
        fetchMock,
        requests: (): GraphQLRequest[] => fetchMock.mock.calls.map(([url, init]) => {
            const { query, variables } = JSON.parse(String(init?.body));
            return { url: String(url), query, variables };
        }),
    };
}

export function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    window.dispatchEvent(new Event('resize'));
}

export const projects = {
    vkPPU: {
        id: 'vkPPU',
        name: 'Vulkan Retro PPU',
        description: 'Vulkan Compute Pipeline for rendering NES games',
        imagePath: '/assets/projectThumbnail/ppu.webp',
    },
    zgal: {
        id: 'zgal',
        name: 'ZGAL',
        description: 'A language for GPU programs that compiles to Vulkan and WebGPU',
        imagePath: '/assets/projectThumbnail/zgal.webp',
    },
    splats: {
        id: 'splats',
        name: 'Gaussian Splatting',
        description: 'A 3D Gaussian splatting trainer and real-time viewer written in ZGAL, running in the browser with WebGPU',
        imagePath: '/assets/projectThumbnail/splats.webp',
    },
    sokoban: {
        id: 'sokoban',
        name: 'Sokoban AI',
        description: 'A* and Q Learning implementations to solve the game Sokoban',
        imagePath: '/assets/projectThumbnail/sokoban.webp',
    },
    seamCarver: {
        id: 'seamCarver',
        name: 'Seam Carver',
        description: "An algorithm for reshaping an image's aspect ratio",
        imagePath: '/assets/projectThumbnail/seamCarver.webp',
    },
    broadAR: {
        id: 'broadAR',
        name: 'Broad AR',
        description: 'An AR experience at The Broad',
        imagePath: '/assets/projectThumbnail/broad.webp',
    },
    metaAvatars: {
        id: 'metaAvatars',
        name: 'Meta Avatars',
        description: 'Rendering for Meta Avatars',
        imagePath: '/assets/projectThumbnail/ava.webp',
    },
};

// Professional project pages, shaped like graphql-server's projectWriteup; test data, not the site's copy
export const writeups = {
    broadAR: {
        context: 'Studio, 2024, engineer',
        imageAlt: 'Visitors holding phones up to a sculpture',
        sections: [
            { heading: null, paragraphs: ['First paragraph.', 'Second paragraph.'] },
            { heading: 'The technical work', paragraphs: ['Third paragraph.'] },
        ],
        articles: [
            {
                title: 'An article with a month',
                source: 'Studio',
                date: '2024-09',
                url: 'https://example.com/first',
                note: 'What the first article covers',
            },
            {
                title: 'An article with a day',
                source: 'Newspaper',
                date: '2024-09-25',
                url: 'https://example.com/second',
                note: 'What the second article covers',
            },
            {
                title: 'An undated article',
                source: 'Blog',
                date: null,
                url: 'https://example.com/third',
                note: 'What the third article covers',
            },
        ],
    },
};

// A fake backend with the write-ups above: projectInfo and projectWriteup by id, null when unknown
export function writeupResolvers() {
    const byId = <T,>(table: Record<string, T>) => ({ id }: Variables) => table[id] ?? null;
    return {
        projectInfo: byId<{ name: string, imagePath: string }>(projects),
        projectWriteup: byId<unknown>(writeups),
    };
}

// Level 0 from the server: the player pushes one box right onto a spot
export const level0 = [
    ['WALL', 'WALL', 'WALL', 'WALL', 'WALL', 'WALL', 'WALL'],
    ['WALL', 'PLAYER', 'EMPTY', 'BOX', 'EMPTY', 'SPOT', 'WALL'],
    ['WALL', 'WALL', 'WALL', 'WALL', 'WALL', 'WALL', 'WALL'],
];

// Moves the player (and any box ahead of it) right along the middle row of level0
export function level0AfterRightMoves(count: number): string[][] {
    const row = ['WALL', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'WALL'];
    const player = 1 + count;
    const box = Math.max(3, player + 1);
    row[5] = box === 5 ? 'FILLED_SPOT' : 'SPOT';
    if (box < 5) row[box] = 'BOX';
    row[player] = 'PLAYER';
    return [level0[0], row, level0[2]];
}

const asLevel = (rows: string[][]) => ({ level: rows.map(row => ({ row })) });

// A fake Sokoban backend that only knows level 0 and moving right
export function sokobanResolvers() {
    return {
        levels: () => ['LEVEL_0', 'LEVEL_1', 'LEVEL_2'],
        sokobanLevel: () => asLevel(level0),
        aStarSolution: () => ['RIGHT', 'RIGHT', 'RIGHT'],
        qLearningSolution: () => ['RIGHT', 'LEFT', 'RIGHT', 'RIGHT', 'RIGHT'],
        levelAfterActions: ({ actions }: Variables) => {
            let position = 0;
            for (const action of actions as string[]) {
                position += action === 'RIGHT' ? 1 : action === 'LEFT' ? -1 : 0;
            }
            return asLevel(level0AfterRightMoves(Math.min(Math.max(position, 0), 3)));
        },
    };
}
