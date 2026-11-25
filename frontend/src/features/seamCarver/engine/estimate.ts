import { Engine, Variant } from './protocol';

// The original Java builds a graph of objects per pixel, about 3.4 KB each, so it takes images up
// to this many pixels (about 310 x 310, the old server's cap: ~330 MB, safe on phones); larger
// images go to the Rust engine (decision D5)
export const JAVA_MAX_PIXELS = 96048;

// Which engine carves an image: the Java up to JAVA_MAX_PIXELS unless the visitor asked for the
// fast one (decision D6), the Rust engine above
export function chooseEngine(pixels: number, preferFast: boolean): Engine {
    return pixels <= JAVA_MAX_PIXELS && !preferFast ? 'java' : 'rust';
}

// The cost of one pixel-seam (a pixel of the image as it is when a seam is removed), in
// nanoseconds: a carve takes about this times pixelSeams(). Every seam reads every pixel, so the
// cost is linear in it. Measured under V8 (Node 24, ./build-seamcarver's golden check and
// seamcarver-web/flat/node-check.mjs --bench) on an M-series Mac, taking the slower end of each
// range; phones may well be a few times slower, so the warning is a rough guide:
// - the Java as WebAssembly: 120x90 -> 90x70 (430k pixel-seams) in 230 ms, 240x180 -> 180x140 in
//   2.4 s: 540-700 ns
// - the Java as JavaScript: 120x90 -> 90x70 in 720 ms: 1.7 us
// - the Rust engine: 1 MP and 12 MP to 75% width: about 5 ns
export const NS_PER_PIXEL_SEAM: { [variant in Variant]: number } = {
    'java-wasm': 700,
    'java-js': 1700,
    'rust': 5,
};

// Above this estimate the page says how long a carve will take and asks before starting (D3: no
// size cap, a warning instead)
export const SLOW_SECONDS = 5;

// The pixels every seam of a carve from width x height to targetWidth x targetHeight sees: the
// vertical seams first (the image narrowing column by column), then the horizontal ones
export function pixelSeams(width: number, height: number, targetWidth: number, targetHeight: number): number {
    const sum = (from: number, to: number) => to <= from ? 0 : (to - from) * (from + 1 + to) / 2;
    return height * sum(targetWidth, width) + targetWidth * sum(targetHeight, height);
}

// The estimated seconds of a carve on an engine. The Java is estimated as WebAssembly, which every
// current browser runs; the JavaScript fallback is about 2.4 times as slow.
export function estimateSeconds(variant: Variant, width: number, height: number,
                                targetWidth: number, targetHeight: number): number {
    return NS_PER_PIXEL_SEAM[variant] * pixelSeams(width, height, targetWidth, targetHeight) / 1e9;
}
