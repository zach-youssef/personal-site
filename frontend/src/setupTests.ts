// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
import { format } from 'node:util';
import { afterEach, beforeEach, vi } from 'vitest';

// Konva needs the native canvas package outside the browser
vi.mock('react-konva', () => import('./testUtils/reactKonvaMock'));

// Fail any test that logs an error or a warning. React's development warnings (missing keys,
// invalid DOM nesting, updates outside act(), etc.) go to console.error, and since React 19 they
// carry no common prefix to pick them out by, so every message counts. A test that expects one
// mocks the method out (`vi.spyOn(console, 'error').mockImplementation(...)`), so it never
// reaches this hook.
const logged: string[] = [];
for (const level of ['error', 'warn'] as const) {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
        logged.push(`console.${level}: ${format(...args).split('\n')[0]}`);
        original(...args);
    };
}

beforeEach(() => {
    logged.length = 0;
});

afterEach(() => {
    if (logged.length > 0) {
        throw new Error(`The test logged errors or warnings:\n${logged.join('\n')}`);
    }
});
