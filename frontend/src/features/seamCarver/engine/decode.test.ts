import { afterEach, describe, expect, it, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { encode } from 'fast-png';
import { decodePixels, decodePng, encodePng, Pixels } from './decode';

// None of these touch a canvas (jsdom has none, nor createImageBitmap): PNGs must decode and
// encode in JavaScript, since browsers with fingerprinting protection add noise to canvas reads

const pixels = (width: number, height: number, rgb: number[]): Pixels =>
    ({ width, height, rgb: Int32Array.from(rgb) });

// A 5x3 image with distinct colours, odd sized so rows don't align to anything
const sample = pixels(5, 3, Array.from({ length: 15 }, (_, i) => (i * 0x1234567 + 0x89ab) & 0xffffff));

const rgbBytes = ({ rgb }: Pixels, alpha?: number) => Uint8Array.from(Array.from(rgb).flatMap(
    v => [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, ...(alpha === undefined ? [] : [alpha])]));

describe('decodePng', () => {
    it('round-trips encodePng exactly', () => {
        expect(decodePng(encodePng(sample))).toEqual(sample);
    });

    it('decodes 8-bit RGB', () => {
        const png = encode({ width: 5, height: 3, data: rgbBytes(sample), depth: 8, channels: 3 });
        expect(decodePng(png)).toEqual(sample);
    });

    it('drops alpha, keeping the colour of transparent pixels (as the Java does)', () => {
        const png = encode({ width: 5, height: 3, data: rgbBytes(sample, 0), depth: 8, channels: 4 });
        expect(decodePng(png)).toEqual(sample);
    });

    it('decodes Adam7-interlaced PNGs', () => {
        const png = encode({ width: 5, height: 3, data: rgbBytes(sample), depth: 8, channels: 3 },
            { interlace: 'Adam7' });
        expect(decodePng(png)).toEqual(sample);
    });

    it('decodes packed palette indices, each row starting on a byte', () => {
        // 3 pixels of 1 bit a row: 101 and 010, padded to a byte each
        const png = encode({
            width: 3, height: 2, depth: 1, channels: 1,
            data: Uint8Array.from([0b10100000, 0b01000000]),
            palette: [[0xff, 0, 0], [0, 0, 0xff]],
        });
        expect(decodePng(png)).toEqual(pixels(3, 2, [0x0000ff, 0xff0000, 0x0000ff, 0xff0000, 0x0000ff, 0xff0000]));
    });

    it('decodes 8-bit palette images', () => {
        const png = encode({
            width: 2, height: 1, depth: 8, channels: 1,
            data: Uint8Array.from([2, 0]),
            palette: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        });
        expect(decodePng(png)).toEqual(pixels(2, 1, [0x070809, 0x010203]));
    });

    it('scales low-bit greyscale to 8 bits', () => {
        // 2 bits: 0, 1, 2, 3
        const png = encode({ width: 4, height: 1, depth: 2, channels: 1, data: Uint8Array.from([0b00011011]) });
        expect(decodePng(png)).toEqual(pixels(4, 1, [0x000000, 0x555555, 0xaaaaaa, 0xffffff]));
    });

    it('scales 16-bit samples to the nearest 8-bit value', () => {
        const png = encode({
            width: 2, height: 1, depth: 16, channels: 3,
            data: Uint16Array.from([0xffff, 0x0000, 0x8080, 0x0101, 0x7f80, 0x0080]),
        });
        expect(decodePng(png)).toEqual(pixels(2, 1, [0xff0080, 0x017f00]));
    });

    it("leaves what isn't a PNG to the browser", () => {
        expect(decodePng(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBeUndefined();
    });

    it('throws on a corrupt PNG', () => {
        const png = encodePng(sample);
        expect(() => decodePng(png.subarray(0, png.length - 20))).toThrow();
    });
});

describe('decodePixels', () => {
    // Node's File, as jsdom's has no arrayBuffer() (every browser's has)
    const file = (bytes: Uint8Array) => new NodeFile([bytes as Uint8Array<ArrayBuffer>], 'image', {}) as unknown as Blob;
    // The browser's decoder, which jsdom lacks: these tests only see whether it's reached
    const browserDecode = () => {
        const decoder = vi.fn(async () => { throw new Error('the browser decoder'); });
        vi.stubGlobal('createImageBitmap', decoder);
        return decoder;
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('decodes a PNG file without the browser decoder or a canvas', async () => {
        const decoder = browserDecode();
        expect(await decodePixels(file(encodePng(sample)))).toEqual(sample);
        expect(decoder).not.toHaveBeenCalled();
    });

    it("leaves a file that isn't a PNG to the browser", async () => {
        const decoder = browserDecode();
        await expect(decodePixels(file(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0])))).rejects
            .toThrow('the browser decoder');
        expect(decoder).toHaveBeenCalledOnce();
    });

    it('leaves a PNG that fast-png refuses to the browser', async () => {
        const decoder = browserDecode();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const png = encodePng(sample);
        await expect(decodePixels(file(png.subarray(0, png.length - 20)))).rejects.toThrow('the browser decoder');
        expect(decoder).toHaveBeenCalledOnce();
        expect(warn).toHaveBeenCalledOnce();
    });
});
