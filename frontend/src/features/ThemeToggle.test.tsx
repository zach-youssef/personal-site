import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navigation from './Navigation';
import ThemeProvider from '../theme/ThemeProvider';
import { stubColorScheme } from '../testUtils/matchMedia';

vi.mock('../theme/theme-dark.scss?inline', () => ({ default: '/* dark */' }));
vi.mock('../theme/theme-light.scss?inline', () => ({ default: '/* light */' }));

function renderNavigation() {
    const view = render(<ThemeProvider><Navigation /></ThemeProvider>);
    return {
        ...view,
        toggle: () => screen.getByRole('switch', { name: 'Dark mode' }),
        navbar: () => view.container.querySelector('.navbar')!,
        stylesheet: () => document.getElementById('theme-stylesheet')?.textContent,
    };
}

describe('Theme toggle', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
        document.getElementById('theme-stylesheet')?.remove();
        delete document.documentElement.dataset.theme;
    });

    it('starts in the system theme', () => {
        stubColorScheme(false);
        const page = renderNavigation();

        expect(page.toggle()).not.toBeChecked();
        expect(page.navbar()).toHaveClass('navbar-light');
        expect(page.stylesheet()).toBe('/* light */');
        expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('switches theme, restyles the navbar and remembers the choice', async () => {
        stubColorScheme(true);
        const page = renderNavigation();
        expect(page.toggle()).toBeChecked();
        expect(page.navbar()).toHaveClass('navbar-dark');

        await userEvent.click(page.toggle());

        expect(page.toggle()).not.toBeChecked();
        expect(page.navbar()).toHaveClass('navbar-light');
        expect(page.stylesheet()).toBe('/* light */');
        expect(window.localStorage.getItem('theme')).toBe('light');
    });

    it('picks the theme of the sun or moon that is clicked', async () => {
        stubColorScheme(true);
        const page = renderNavigation();
        const sun = page.container.querySelector('.theme-icon-light')!;
        const moon = page.container.querySelector('.theme-icon-dark')!;

        await userEvent.click(sun);
        expect(page.toggle()).not.toBeChecked();
        await userEvent.click(sun);
        expect(page.toggle()).not.toBeChecked();

        await userEvent.click(moon);
        expect(page.toggle()).toBeChecked();
        expect(window.localStorage.getItem('theme')).toBe('dark');
    });

    it('restores a remembered choice', () => {
        stubColorScheme(true);
        window.localStorage.setItem('theme', 'light');

        const page = renderNavigation();

        expect(page.toggle()).not.toBeChecked();
    });

    it('follows system theme changes until the visitor picks a theme', async () => {
        const system = stubColorScheme(true);
        const page = renderNavigation();

        act(() => system.setDark(false));
        expect(page.toggle()).not.toBeChecked();

        await userEvent.click(page.toggle());
        act(() => system.setDark(false));
        expect(page.toggle()).toBeChecked();
    });

    it('stops listening for system changes when unmounted', () => {
        const system = stubColorScheme(true);
        const page = renderNavigation();
        expect(system.listenerCount()).toBe(1);

        page.unmount();

        expect(system.listenerCount()).toBe(0);
    });
});
