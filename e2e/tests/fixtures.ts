import { test as base, expect, Page, Response } from '@playwright/test';
import { BACKEND_ORIGIN, PRODUCTION_ORIGIN } from './servers';

export const test = base.extend({
    context: async ({ context, baseURL }, use) => {
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin === PRODUCTION_ORIGIN) {
                // Send API and asset requests meant for production to the local backend.
                // Pages that redirect away can end the test while a request is in flight.
                const response = await route.fetch({ url: BACKEND_ORIGIN + url.pathname + url.search }).catch(() => null);
                if (response) {
                    await route.fulfill({ response }).catch(() => {});
                }
            } else if (url.origin === new URL(baseURL!).origin) {
                await route.continue();
            } else {
                // Keep the tests hermetic, e.g. when following links to external project pages
                await route.fulfill({ status: 200, contentType: 'text/html', body: '' });
            }
        });
        await use(context);
    },
});

export { expect };

// Waits for the next GraphQL response whose query mentions the given root field
export function graphQLResponse(page: Page, field: string): Promise<Response> {
    return page.waitForResponse(response =>
        response.url() === `${PRODUCTION_ORIGIN}/graphql`
        && new RegExp(`\\b${field}\\b`).test(response.request().postData() ?? ''));
}
