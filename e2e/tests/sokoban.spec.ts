import { test, expect, graphQLResponse } from './fixtures';
import { Page, Response } from '@playwright/test';

async function openSokoban(page: Page) {
    const levelLoaded = graphQLResponse(page, 'sokobanLevel');
    await page.goto('/projects/sokoban');
    const body = await (await levelLoaded).json();
    await expect(page.locator('canvas').first()).toBeVisible();
    return body;
}

// Middle row of level 0, where all the action happens
async function levelRow(response: Promise<Response>) {
    const body = await (await response).json();
    expect(body.errors).toBeUndefined();
    return body.data.levelAfterActions.level[1].row;
}

test('loads the first level and its solutions', async ({ page }) => {
    const body = await openSokoban(page);

    expect(body.errors).toBeUndefined();
    expect(body.data.sokobanLevel.level[1].row).toEqual(['WALL', 'PLAYER', 'EMPTY', 'BOX', 'EMPTY', 'SPOT', 'WALL']);
    expect(body.data.aStarSolution).toEqual(['RIGHT', 'RIGHT', 'RIGHT']);
    expect(body.data.qLearningSolution.length).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Next Move' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('steps through the A* solution to the solved level and back', async ({ page }) => {
    await openSokoban(page);
    const next = page.getByRole('button', { name: 'Next Move' });
    const undo = page.getByRole('button', { name: 'Undo' });

    let row: string[] = [];
    for (let i = 0; i < 3; i++) {
        const response = graphQLResponse(page, 'levelAfterActions');
        await next.click();
        row = await levelRow(response);
    }

    expect(row).toEqual(['WALL', 'EMPTY', 'EMPTY', 'EMPTY', 'PLAYER', 'FILLED_SPOT', 'WALL']);
    await expect(next).toBeDisabled();

    const response = graphQLResponse(page, 'levelAfterActions');
    await undo.click();
    expect(await levelRow(response)).toEqual(['WALL', 'EMPTY', 'EMPTY', 'PLAYER', 'BOX', 'SPOT', 'WALL']);
    await expect(next).toBeEnabled();
});

test('switching levels loads the new level and solution', async ({ page }) => {
    await openSokoban(page);

    const levelLoaded = graphQLResponse(page, 'sokobanLevel');
    await page.getByRole('button', { name: 'Level Select' }).click();
    await page.getByRole('button', { name: 'LEVEL_1' }).click();
    const response = await levelLoaded;

    expect(JSON.parse(response.request().postData()!).variables).toEqual({ level: 'LEVEL_1' });
    const body = await response.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.sokobanLevel.level).toHaveLength(5);
    expect(body.data.aStarSolution.length).toBeGreaterThan(0);
});

test('plays the level with arrow keys in manual mode', async ({ page }) => {
    await openSokoban(page);

    const reloaded = graphQLResponse(page, 'sokobanLevel');
    await page.getByRole('button', { name: 'Agent Select' }).click();
    await page.getByRole('button', { name: 'Manual' }).click();
    await reloaded;
    await expect(page.getByRole('button', { name: 'Next Move' })).toBeDisabled();

    const moved = graphQLResponse(page, 'levelAfterActions');
    await page.keyboard.press('ArrowRight');
    expect(await levelRow(moved)).toEqual(['WALL', 'EMPTY', 'PLAYER', 'BOX', 'EMPTY', 'SPOT', 'WALL']);

    const pushed = graphQLResponse(page, 'levelAfterActions');
    await page.keyboard.press('ArrowRight');
    expect(await levelRow(pushed)).toEqual(['WALL', 'EMPTY', 'EMPTY', 'PLAYER', 'BOX', 'SPOT', 'WALL']);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});
