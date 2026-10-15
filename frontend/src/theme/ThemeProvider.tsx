import React, { useEffect, useLayoutEffect, useState } from 'react';
import { applyTheme, initialTheme, onSystemThemeChange, storedTheme, storeTheme, Theme } from './theme';
import { ThemeContext } from './themeContext';

function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(initialTheme);

    // Before paint, so the page never shows unstyled or in the wrong theme
    useLayoutEffect(() => applyTheme(theme), [theme]);

    // Follow the operating system until the visitor picks a theme themselves
    useEffect(() => onSystemThemeChange(system => {
        if (storedTheme() === null) {
            setThemeState(system);
        }
    }), []);

    const setTheme = (next: Theme) => {
        storeTheme(next);
        setThemeState(next);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export default ThemeProvider;
