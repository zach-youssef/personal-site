import { Page } from '@playwright/test';

// The games ./build-ppu builds into the backend's assets, by their frames' titles
export const GAMES = [['smb3', 'Super Mario Bros. 3'], ['batman', 'Batman']];

export function gameFrame(page: Page, title: string) {
    return page.locator(`iframe[title="${title}"]`);
}
