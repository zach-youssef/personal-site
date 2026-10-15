import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initialTheme, onSystemThemeChange, storedTheme, storeTheme, systemTheme } from './theme';
import { stubColorScheme } from '../testUtils/matchMedia';

// Vitest doesn't compile Sass, so stand in for the two stylesheets
vi.mock('./theme-dark.scss?inline', () => ({ default: 'body { background: black }' }));
vi.mock('./theme-light.scss?inline', () => ({ default: 'body { background: white }' }));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.getElementById('theme-stylesheet')?.remove();
    delete document.documentElement.dataset.theme;
});

describe('initialTheme', () => {
    it('follows the system preference when nothing is stored', () => {
        stubColorScheme(false);
        expect(initialTheme()).toBe('light');

        stubColorScheme(true);
        expect(initialTheme()).toBe('dark');
    });

    it('prefers the stored choice over the system preference', () => {
        stubColorScheme(true);
        storeTheme('light');

        expect(initialTheme()).toBe('light');
    });

    it('defaults to dark when the browser has no color scheme query', () => {
        expect(window.matchMedia).toBeUndefined();
        expect(systemTheme()).toBe('dark');
    });
});

describe('storedTheme', () => {
    it('ignores values that are not themes', () => {
        window.localStorage.setItem('theme', 'sepia');

        expect(storedTheme()).toBeNull();
    });

    it('treats unavailable storage as no choice', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });

        expect(() => storeTheme('light')).not.toThrow();
        expect(storedTheme()).toBeNull();
    });
});

describe('applyTheme', () => {
    it('swaps a single stylesheet and marks the document with the theme', () => {
        applyTheme('dark');
        applyTheme('light');

        const styles = document.querySelectorAll('#theme-stylesheet');
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe('body { background: white }');
        expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('puts the theme before other stylesheets so the app can override it', () => {
        const appStyle = document.createElement('style');
        document.head.append(appStyle);

        applyTheme('dark');

        expect(document.head.firstElementChild?.id).toBe('theme-stylesheet');
        appStyle.remove();
    });
});

describe('onSystemThemeChange', () => {
    it('reports changes until unsubscribed', () => {
        const system = stubColorScheme(true);
        const callback = vi.fn();

        const unsubscribe = onSystemThemeChange(callback);
        system.setDark(false);
        unsubscribe();
        system.setDark(true);

        expect(callback.mock.calls).toEqual([['light']]);
        expect(system.listenerCount()).toBe(0);
    });
});
