// Decoding the chosen image to the engines' pixels, and encoding a result as a PNG, in the browser.
//
// PNGs are decoded and results encoded in JavaScript (fast-png), never through a canvas: browsers
// with fingerprinting protection (Brave by default, Safari's and Firefox's private windows,
// Firefox's resistFingerprinting) add noise to what a canvas reads back, which would change the
// seams the engines find. A colour or palette PNG (any bit depth up to 8, interlaced or not,
// transparent or not) gives exactly the pixels the original Java read with ImageIO, alpha
// dropped. Greyscale and 16-bit PNGs are converted the plain way (ImageIO gamma-converts
// greyscale), so they may differ slightly from the Java's, as may PNGs with an embedded colour
// profile. Other formats (JPEG, WebP, ...) go through the browser's decoder and a canvas, so they
// may differ too, and are subject to that noise.
import { decode as decodePngData, encode as encodePngData, hasPngSignature } from 'fast-png';

export type Pixels = {
    width: number,
    height: number,
    // Row-major 0x00RRGGBB, alpha dropped (as the Java's TYPE_INT_RGB)
    rgb: Int32Array,
};

// A PNG's pixels, or undefined if the bytes aren't a PNG. Throws on a corrupt PNG.
export function decodePng(bytes: Uint8Array): Pixels | undefined {
    if (!hasPngSignature(bytes)) return undefined;
    const png = decodePngData(bytes);
    const { width, height, depth, channels, data, palette } = png;
    // Samples per row; below 8 bits they are packed, each row starting on a byte
    const perRow = width * channels;
    const rowBytes = Math.ceil(perRow * depth / 8);
    const sample = depth >= 8
        ? (y: number, i: number) => data[y * perRow + i]
        : (y: number, i: number) => {
            const bit = i * depth;
            return (data[y * rowBytes + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        };
    const max = (1 << depth) - 1;
    const to8 = depth === 8 ? (v: number) => v : (v: number) => Math.round(v * 255 / max);
    const rgb = new Int32Array(width * height);
    for (let y = 0, at = 0; y < height; y++) {
        for (let x = 0; x < width; x++, at++) {
            const i = x * channels;
            if (palette) {
                const [r, g, b] = palette[sample(y, i)] ?? [0, 0, 0];
                rgb[at] = (r << 16) | (g << 8) | b;
            } else if (channels <= 2) {
                const v = to8(sample(y, i));
                rgb[at] = (v << 16) | (v << 8) | v;
            } else {
                rgb[at] = (to8(sample(y, i)) << 16) | (to8(sample(y, i + 1)) << 8) | to8(sample(y, i + 2));
            }
        }
    }
    return { width, height, rgb };
}

// The pixels as an 8-bit RGB PNG
export function encodePng({ width, height, rgb }: Pixels): Uint8Array {
    const data = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < rgb.length; i++, j += 3) {
        data[j] = (rgb[i] >> 16) & 0xff;
        data[j + 1] = (rgb[i] >> 8) & 0xff;
        data[j + 2] = rgb[i] & 0xff;
    }
    return encodePngData({ width, height, data, depth: 8, channels: 3 });
}

function canvas(width: number, height: number): HTMLCanvasElement {
    const element = document.createElement('canvas');
    element.width = width;
    element.height = height;
    return element;
}

// Through the browser's decoder and a canvas, for what isn't a PNG
async function decodeWithCanvas(blob: Blob): Promise<Pixels> {
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    try {
        const { width, height } = bitmap;
        const context = canvas(width, height).getContext('2d');
        if (!context) throw new Error('No 2D canvas');
        context.drawImage(bitmap, 0, 0);
        const rgba = context.getImageData(0, 0, width, height).data;
        const rgb = new Int32Array(width * height);
        for (let i = 0, j = 0; i < rgb.length; i++, j += 4) {
            rgb[i] = (rgba[j] << 16) | (rgba[j + 1] << 8) | rgba[j + 2];
        }
        return { width, height, rgb };
    } finally {
        bitmap.close();
    }
}

// Rejects if the file can't be decoded (or the browser can't hold an image that large). A PNG that
// fast-png refuses (it is stricter than browsers about odd chunks) goes to the browser instead.
export async function decodePixels(blob: Blob): Promise<Pixels> {
    // The signature alone decides, so a large JPEG isn't read twice
    if (hasPngSignature(new Uint8Array(await blob.slice(0, 8).arrayBuffer()))) {
        try {
            const pixels = decodePng(new Uint8Array(await blob.arrayBuffer()));
            if (pixels) return pixels;
        } catch (e) {
            console.warn(`Decoding the PNG in JavaScript failed, so the browser decodes it: ${e}`);
        }
    }
    return decodeWithCanvas(blob);
}

// Draws 0x00RRGGBB pixels onto a canvas, opaque, for display only (nothing reads it back)
export function drawPixels(target: HTMLCanvasElement, { width, height, rgb }: Pixels): void {
    target.width = width;
    target.height = height;
    const context = target.getContext('2d');
    if (!context) return;
    const image = context.createImageData(width, height);
    const rgba = image.data;
    for (let i = 0, j = 0; i < rgb.length; i++, j += 4) {
        rgba[j] = (rgb[i] >> 16) & 0xff;
        rgba[j + 1] = (rgb[i] >> 8) & 0xff;
        rgba[j + 2] = rgb[i] & 0xff;
        rgba[j + 3] = 0xff;
    }
    context.putImageData(image, 0, 0);
}
