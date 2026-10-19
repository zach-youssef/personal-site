import { Locator, Page } from '@playwright/test';

// Counts the distinct colors in a screenshot of an element, e.g. to tell a drawn canvas from a cleared one
export async function colorCount(page: Page, element: Locator): Promise<number> {
    const png = await element.screenshot();
    return page.evaluate(async dataUrl => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const decoded = document.createElement('canvas');
        decoded.width = image.width;
        decoded.height = image.height;
        const context = decoded.getContext('2d')!;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        const colors = new Set<number>();
        for (let i = 0; i < pixels.length; i += 4) {
            colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
        }
        return colors.size;
    }, `data:image/png;base64,${png.toString('base64')}`);
}

export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', message => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });
    page.on('pageerror', error => errors.push(error.message));
    return errors;
}
