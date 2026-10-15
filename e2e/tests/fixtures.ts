import { test as base, expect, Page, Response } from '@playwright/test';

export const test = base.extend({
    context: async ({ context, baseURL }, use) => {
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            // The preview server forwards backend requests to the local backend.
            // Pages that redirect away can end the test while a request is in flight.
            if (url.origin === new URL(baseURL!).origin) {
                await route.continue().catch(() => {});
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
        new URL(response.url()).pathname === '/graphql'
        && new RegExp(`\\b${field}\\b`).test(response.request().postData() ?? ''));
}
