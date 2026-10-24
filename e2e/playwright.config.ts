import { defineConfig, devices } from '@playwright/test';
import { BACKEND_ORIGIN, BACKEND_PORT, FRONTEND_PORT } from './tests/servers';

// Runs the real backend and a production build of the frontend side by side.
// The frontend requests the backend relative to the page, and the preview
// server forwards those requests to the local backend, as Ktor does in production.
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    // On CI, a dot per test and the failures in full; the HTML report and the failures' traces
    // are uploaded as artifacts
    reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
    globalSetup: './tests/globalSetup.ts',
    use: {
        baseURL: `http://localhost:${FRONTEND_PORT}`,
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: [
        {
            command: './gradlew run --quiet',
            cwd: '../graphql-server',
            env: { PORT: String(BACKEND_PORT) },
            url: `http://localhost:${BACKEND_PORT}/graphql`,
            timeout: 180_000,
            reuseExistingServer: !process.env.CI,
        },
        {
            command: `npm run build && npx vite preview --port ${FRONTEND_PORT} --strictPort`,
            cwd: '../frontend',
            // Stop Vite from opening a browser window, and point its proxy at the test backend
            env: { BROWSER: 'none', BACKEND_URL: BACKEND_ORIGIN },
            url: `http://localhost:${FRONTEND_PORT}`,
            timeout: 120_000,
            reuseExistingServer: !process.env.CI,
        },
    ],
});
