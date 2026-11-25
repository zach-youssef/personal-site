import { defineConfig, devices } from '@playwright/test';
import { BACKEND_ORIGIN, BACKEND_PORT, FRONTEND_PORT } from './tests/servers';

// Runs the real backend and a production build of the frontend side by side.
// The frontend requests the backend relative to the page, and the preview
// server forwards those requests to the local backend, as Ktor does in production.

// E2E_REUSE_SERVERS=1 (ignored on CI) reuses servers already answering on the ports, for quick
// reruns against servers kept up by hand; it's off by default since on a shared machine they may
// be another checkout's
const reuseServers = !process.env.CI && process.env.E2E_REUSE_SERVERS === '1';
// Unless reusing, each server's command first refuses a port that's taken
const requireFreePort = (port: number) => reuseServers ? '' : `node ../e2e/requireFreePort.mjs ${port} && `;

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
    // Every test runs in Chromium. Firefox runs only the tests tagged '@firefox': those where it can
    // behave differently from Chromium (layout and CSS, keyboard and focus, file uploads, pages
    // without WebGPU). Tests that only call the backend ({ request }), or check app-level logic
    // such as a stubbed missing WebGPU adapter, run once. The GPU specs in tests/gpu/ are untagged:
    // they run Chromium's WebGPU on SwiftShader (see tests/gpu/webgpu.ts), and headless Firefox
    // has no WebGPU adapter. The project's grep combines with a command-line --grep (both must match).
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@firefox/ },
    ],
    // The servers' ports are fixed (tests/servers.ts), so a run refuses ports that are taken rather
    // than test what answers there, which may be another checkout's servers (see reuseServers)
    webServer: [
        {
            command: `${requireFreePort(BACKEND_PORT)}./gradlew run --quiet`,
            cwd: '../graphql-server',
            env: { PORT: String(BACKEND_PORT) },
            url: `http://localhost:${BACKEND_PORT}/graphql`,
            timeout: 180_000,
            reuseExistingServer: reuseServers,
        },
        {
            command: `${requireFreePort(FRONTEND_PORT)}npm run build && npx vite preview --port ${FRONTEND_PORT} --strictPort`,
            cwd: '../frontend',
            // Stop Vite from opening a browser window, and point its proxy at the test backend
            env: { BROWSER: 'none', BACKEND_URL: BACKEND_ORIGIN },
            url: `http://localhost:${FRONTEND_PORT}`,
            timeout: 120_000,
            reuseExistingServer: reuseServers,
        },
    ],
});
