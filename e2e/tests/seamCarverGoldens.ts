import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from './fixtures';

// The seam carver's goldens (testdata/seamcarver, written by the original Java on the JVM): .in is
// a case's input, .out what the Java carved it to, .energy (one case) the Java's energy map of the input
const GOLDENS = resolve(__dirname, '../../testdata/seamcarver');

// A golden of any kind: little-endian int32 width and height, then 0x00RRGGBB int32 pixels
export function readGolden(name: string) {
    const bytes = readFileSync(resolve(GOLDENS, name));
    const width = bytes.readInt32LE(0);
    const height = bytes.readInt32LE(4);
    expect(bytes.length).toBe(8 + 4 * width * height);
    const rgb: number[] = [];
    for (let i = 0; i < width * height; i++) rgb.push(bytes.readInt32LE(8 + 4 * i));
    return { width, height, rgb };
}
export type GoldenImage = ReturnType<typeof readGolden>;
