import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGraphQL } from './FetchHelper';

describe('fetchGraphQL', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('posts the query and variables as JSON to the GraphQL endpoint', async () => {
        const fetchMock = vi.fn(async () => ({ json: async () => ({ data: { levels: ['LEVEL_0'] } }) }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await fetchGraphQL('query { levels }', { a: 1 });

        expect(response).toEqual({ data: { levels: ['LEVEL_0'] } });
        expect(fetchMock).toHaveBeenCalledWith('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'query { levels }', variables: { a: 1 } }),
        });
    });

    it('propagates network failures', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

        await expect(fetchGraphQL('query { levels }', {})).rejects.toThrow('Failed to fetch');
    });
});
