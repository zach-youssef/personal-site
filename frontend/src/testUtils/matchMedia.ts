import { vi } from 'vitest';

// jsdom has no matchMedia; this stands in for the (prefers-color-scheme: dark) query
export function stubColorScheme(initiallyDark: boolean) {
    let matches = initiallyDark;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const query = {
        get matches() { return matches; },
        media: '(prefers-color-scheme: dark)',
        addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => query));

    return {
        listenerCount: () => listeners.size,
        // Simulates the operating system switching between light and dark
        setDark(dark: boolean) {
            matches = dark;
            listeners.forEach(listener => listener({ matches: dark } as MediaQueryListEvent));
        },
    };
}
