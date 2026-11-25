import { describe, expect, it } from 'vitest';
import { FrameMessage } from './engine/protocol';
import { afterStep, frameShows, nextSeam, seamPath, validTarget } from './seamView';

const frame = (layer: 'image' | 'energy', seam?: 'vertical' | 'horizontal'): FrameMessage => ({
    type: 'frame', session: 1, width: 3, height: 2, layer, pixels: new Int32Array(6), removed: 0,
    seam: seam && { direction: seam, positions: new Uint32Array(seam === 'vertical' ? 2 : 3) },
});

describe('nextSeam', () => {
    it('removes every vertical seam first, then the horizontal ones, as SeamCarver.carve does', () => {
        const target = { width: 2, height: 1 };
        expect(nextSeam({ width: 3, height: 2 }, target)).toBe('vertical');
        expect(nextSeam({ width: 2, height: 2 }, target)).toBe('horizontal');
        expect(nextSeam({ width: 2, height: 1 }, target)).toBeUndefined();
        expect(nextSeam({ width: 3, height: 2 }, undefined)).toBeUndefined();
    });

    it('counts the size down a seam at a time', () => {
        expect(afterStep({ width: 3, height: 2 }, 'vertical')).toEqual({ width: 2, height: 2 });
        expect(afterStep({ width: 3, height: 2 }, 'horizontal')).toEqual({ width: 3, height: 1 });
    });
});

describe('validTarget', () => {
    const image = { width: 60, height: 40 };
    it('takes whole targets from 1 up to the image', () => {
        expect(validTarget(image, 45, 32)).toEqual({ width: 45, height: 32 });
        expect(validTarget(image, 60, 40)).toEqual({ width: 60, height: 40 });
        expect(validTarget(image, 1, 1)).toEqual({ width: 1, height: 1 });
    });

    it('refuses empty, zero, too large and fractional targets', () => {
        expect(validTarget(image, NaN, 32)).toBeUndefined();
        expect(validTarget(image, 0, 32)).toBeUndefined();
        expect(validTarget(image, 61, 32)).toBeUndefined();
        expect(validTarget(image, 45, 41)).toBeUndefined();
        expect(validTarget(image, 4.5, 32)).toBeUndefined();
    });
});

describe('frameShows', () => {
    it('needs no frame for the plain image', () => {
        expect(frameShows(undefined, 'image', undefined)).toBe(true);
        expect(frameShows(undefined, 'energy', undefined)).toBe(false);
        expect(frameShows(undefined, 'image', 'vertical')).toBe(false);
    });

    it('matches the layer and the seam', () => {
        expect(frameShows(frame('energy', 'vertical'), 'energy', 'vertical')).toBe(true);
        expect(frameShows(frame('energy', 'vertical'), 'image', 'vertical')).toBe(false);
        expect(frameShows(frame('energy', 'vertical'), 'energy', 'horizontal')).toBe(false);
        expect(frameShows(frame('energy', 'vertical'), 'energy', undefined)).toBe(false);
        expect(frameShows(frame('image'), 'image', undefined)).toBe(true);
    });
});

describe('seamPath', () => {
    it('draws one pixel per row of a vertical seam', () => {
        expect(seamPath({ direction: 'vertical', positions: Uint32Array.of(2, 1, 1) }))
            .toBe('M2 0h1v1h-1zM1 1h1v1h-1zM1 2h1v1h-1z');
    });

    it('draws one pixel per column of a horizontal seam', () => {
        expect(seamPath({ direction: 'horizontal', positions: Uint32Array.of(0, 1) }))
            .toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
    });
});
