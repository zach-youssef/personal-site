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
        imagePath: 'http://zyoussef.com/assets/projectThumbnail/ppu.png',
    },
    sokoban: {
        id: 'sokoban',
        name: 'Sokoban AI',
        description: 'A* and Q Learning implementations to solve the game Sokoban',
        imagePath: 'http://zyoussef.com/assets/projectThumbnail/sokoban.png',
    },
    seamCarver: {
        id: 'seamCarver',
        name: 'Seam Carver',
        description: "An algorithm for reshaping an image's aspect ratio",
        imagePath: 'http://zyoussef.com/assets/projectThumbnail/seamCarver.png',
    },
};

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
            for (const action of actions as (string | number)[]) {
                // Manual moves are sent as enum ordinals, which the server maps onto SokobanMove
                const move = typeof action === 'number' ? ['UP', 'DOWN', 'LEFT', 'RIGHT'][action] : action;
                position += move === 'RIGHT' ? 1 : move === 'LEFT' ? -1 : 0;
            }
            return asLevel(level0AfterRightMoves(Math.min(Math.max(position, 0), 3)));
        },
    };
}
