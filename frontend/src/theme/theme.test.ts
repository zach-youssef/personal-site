import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileString } from 'sass';
import { applyTheme, initialTheme, onSystemThemeChange, storedTheme, storeTheme, systemTheme, THEME_COLORS, Theme } from './theme';
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

    it('sets the browser toolbar colour to the theme, whatever the system prefers', () => {
        const metas = ['light', 'dark'].map(scheme => {
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.media = `(prefers-color-scheme: ${scheme})`;
            document.head.append(meta);
            return meta;
        });

        applyTheme('dark');
        expect(metas.map(meta => meta.content)).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);
        applyTheme('light');
        expect(metas.map(meta => meta.content)).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
        metas.forEach(meta => meta.remove());
    });
});

describe('THEME_COLORS', () => {
    const themes: Theme[] = ['light', 'dark'];

    it.each(themes)('matches the %s header colour', theme => {
        // Sass keeps colours in the space they were made in, so read the header's RGB channels
        const css = compileString(`
            @use "sass:color";
            @use "sass:math";
            @import "base-colors";
            @import "palette-${theme}";
            a { --rgb: #{math.round(color.channel($navbar-bg, "red", $space: rgb))},
                       #{math.round(color.channel($navbar-bg, "green", $space: rgb))},
                       #{math.round(color.channel($navbar-bg, "blue", $space: rgb))}; }
        `, { loadPaths: [__dirname], silenceDeprecations: ['import'], style: 'compressed' }).css;
        const hex = THEME_COLORS[theme];
        const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');

        expect(css.replace(/\s/g, '')).toContain(`--rgb:${rgb}`);
    });

    it.each(themes)('starts index.html on the %s colour for that system theme', theme => {
        const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');

        expect(html).toContain(`<meta name="theme-color" media="(prefers-color-scheme: ${theme})" content="${THEME_COLORS[theme]}" />`);
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
