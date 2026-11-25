import { describe, expect, it } from 'vitest';
import { chooseEngine, estimateSeconds, JAVA_MAX_PIXELS, NS_PER_PIXEL_SEAM, pixelSeams } from './estimate';

describe('chooseEngine', () => {
    it('gives the Java images up to its limit and the Rust engine larger ones', () => {
        expect(JAVA_MAX_PIXELS).toBe(96048);
        expect(chooseEngine(1, false)).toBe('java');
        expect(chooseEngine(JAVA_MAX_PIXELS, false)).toBe('java');
        expect(chooseEngine(JAVA_MAX_PIXELS + 1, false)).toBe('rust');
    });

    it('uses the Rust engine when the visitor asks for the fast one', () => {
        expect(chooseEngine(1, true)).toBe('rust');
        expect(chooseEngine(JAVA_MAX_PIXELS, true)).toBe('rust');
        expect(chooseEngine(JAVA_MAX_PIXELS + 1, true)).toBe('rust');
    });
});

describe('pixelSeams', () => {
    // Counts what the engines' loop does: each seam visits the image as it is then
    function counted(width: number, height: number, targetWidth: number, targetHeight: number) {
        let total = 0;
        for (let w = width; w > targetWidth; w--) total += w * height;
        for (let h = height; h > targetHeight; h--) total += targetWidth * h;
        return total;
    }

    it.each([
        [12, 10, 9, 10], [12, 10, 12, 7], [12, 10, 8, 6], [12, 10, 12, 10],
        [33, 17, 1, 17], [2000, 1500, 1000, 1500], [60, 40, 45, 32],
    ])('counts %ix%i -> %ix%i', (width, height, targetWidth, targetHeight) => {
        expect(pixelSeams(width, height, targetWidth, targetHeight)).toBe(counted(width, height, targetWidth, targetHeight));
    });
});

describe('estimateSeconds', () => {
    it('scales the pixel-seams by the engine', () => {
        const seams = pixelSeams(2000, 1500, 1500, 1500);
        expect(estimateSeconds('rust', 2000, 1500, 1500, 1500)).toBeCloseTo(seams * NS_PER_PIXEL_SEAM.rust / 1e9);
        expect(estimateSeconds('java-wasm', 310, 310, 200, 200))
            .toBeGreaterThan(estimateSeconds('rust', 310, 310, 200, 200));
        expect(estimateSeconds('java-js', 100, 100, 100, 100)).toBe(0);
    });

    it('expects a 2000 x 1500 image carved to half its width on Rust to be slow', () => {
        expect(estimateSeconds('rust', 2000, 1500, 1000, 1500)).toBeGreaterThan(5);
    });
});
