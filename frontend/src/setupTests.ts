// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
import { format } from 'node:util';
import { afterEach, beforeEach, vi } from 'vitest';

// Konva needs the native canvas package outside the browser
vi.mock('react-konva', () => import('./testUtils/reactKonvaMock'));

// Treat React's development warnings (missing keys, invalid DOM nesting, etc.) as test failures
const reactWarnings: string[] = [];
const consoleError = console.error;
console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('Warning:')) {
        reactWarnings.push(format(...args).split('\n')[0]);
    }
    consoleError(...args);
};

beforeEach(() => {
    reactWarnings.length = 0;
});

afterEach(() => {
    if (reactWarnings.length > 0) {
        throw new Error(`React logged warnings:\n${reactWarnings.join('\n')}`);
    }
});
