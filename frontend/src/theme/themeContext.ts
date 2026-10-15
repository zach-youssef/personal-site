import { createContext, useContext } from 'react';
import { Theme } from './theme';

export interface ThemeState {
    theme: Theme
    setTheme: (theme: Theme) => void
}

// Kept apart from ThemeProvider: a module exporting both a component and a hook can't be
// fast refreshed, and reloading it would create a second context that consumers then read.
// Without a provider, components render in the default dark theme and can't change it.
export const ThemeContext = createContext<ThemeState>({ theme: 'dark', setTheme: () => {} });

export function useTheme(): ThemeState {
    return useContext(ThemeContext);
}
