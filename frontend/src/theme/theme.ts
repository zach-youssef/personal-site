import darkCss from './theme-dark.scss?inline';
import lightCss from './theme-light.scss?inline';

export type Theme = 'light' | 'dark';

// Both themes are full Bootstrap builds from the same Sass, so every component is
// styled in either mode; switching swaps which one is in the page.
const stylesheets: Record<Theme, string> = { dark: darkCss, light: lightCss };

const STORAGE_KEY = 'theme';
const STYLE_ELEMENT_ID = 'theme-stylesheet';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// The header's colour in each theme ($navbar-bg in the palettes), which browsers use to tint their
// toolbar. index.html starts with these for the system theme, before the visitor's choice is known.
export const THEME_COLORS: Record<Theme, string> = { light: '#f5d6dc', dark: '#1d1a23' };

function isTheme(value: unknown): value is Theme {
    return value === 'light' || value === 'dark';
}

// The theme the visitor picked with the toggle, if any.
// Storage can be unavailable (private windows, blocked site data), so failures mean "no choice".
export function storedTheme(): Theme | null {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return isTheme(value) ? value : null;
    } catch {
        return null;
    }
}

export function storeTheme(theme: Theme) {
    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // The choice still applies for this visit
    }
}

function darkQuery(): MediaQueryList | null {
    return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
}

// The operating system's preference; dark when the browser can't say, as the site was dark-only
export function systemTheme(): Theme {
    const query = darkQuery();
    return query && !query.matches ? 'light' : 'dark';
}

export function initialTheme(): Theme {
    return storedTheme() ?? systemTheme();
}

// Calls back with the system theme whenever it changes; returns a function that stops listening
export function onSystemThemeChange(callback: (theme: Theme) => void): () => void {
    const query = darkQuery();
    if (!query) {
        return () => {};
    }
    const listener = (event: MediaQueryListEvent) => callback(event.matches ? 'dark' : 'light');
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}

export function applyTheme(theme: Theme) {
    let style = document.getElementById(STYLE_ELEMENT_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ELEMENT_ID;
        // First in <head>, so the app's own stylesheets still override Bootstrap
        document.head.prepend(style);
    }
    style.textContent = stylesheets[theme];
    document.documentElement.dataset.theme = theme;
    // The toggle can pick a theme other than the system's, so every theme-color tag follows it
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', THEME_COLORS[theme]));
}
