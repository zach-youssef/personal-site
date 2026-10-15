import { test as base, expect, Page, Response } from '@playwright/test';
import { resolve } from 'node:path';
import { BACKEND_ORIGIN, PRODUCTION_ORIGIN } from './servers';

// The site loads a Bootswatch theme from its CDN; serve the installed Bootstrap build instead
const BOOTSTRAP_CSS = resolve(__dirname, '../../frontend/node_modules/bootstrap/dist/css/bootstrap.min.css');

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
            } else if (url.hostname === 'bootswatch.com' && url.pathname.endsWith('/bootstrap.min.css')) {
                await route.fulfill({ path: BOOTSTRAP_CSS });
            } else if (url.origin === new URL(baseURL!).origin) {
                // The build references its assets relative to the page, so nested routes request
                // /projects/assets/...; production serves these through a matching backend route
                await route.continue({ url: url.href.replace('/projects/assets/', '/assets/') });
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
