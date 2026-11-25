#!/usr/bin/env node
// Runs the built WebAssembly engine (build.sh <dir>) under Node over every golden in
// testdata/seamcarver and exits 1 on any differing pixel. With --bench it also times a 1 MP and a
// 12 MP noisy gradient carved to 75% width, as `cargo bench` does natively, for the page's
// slow-warning constant.
//
//   node node-check.mjs <dir> [--bench] [--quick]
//
// For working on the crate alone and for the benchmark: the site's build (./build-seamcarver) runs
// the module it ships over the goldens itself, in ../golden-check.mjs with the Java engines.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
  console.error('usage: node node-check.mjs <built dir> [--bench] [--quick]');
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
const goldens = join(here, '..', '..', 'testdata', 'seamcarver');

const { default: init, Carver } = await import(pathToFileURL(resolve(dir, 'flat.js')).href);
await init({ module_or_path: readFileSync(resolve(dir, 'flat_bg.wasm')) });

// A .in or .out file: little-endian int32 width and height, then 0x00RRGGBB int32 pixels
function readImage(path) {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getInt32(0, true);
  const height = view.getInt32(4, true);
  if (bytes.byteLength !== 8 + 4 * width * height) throw new Error(`${path}: size`);
  const rgb = new Uint32Array(width * height);
  for (let i = 0; i < rgb.length; i++) rgb[i] = view.getUint32(8 + 4 * i, true);
  return { width, height, rgb };
}

// The worker's loop: all vertical seams, then all horizontal ones
function carve(input, targetWidth, targetHeight) {
  const carver = new Carver(input.rgb, input.width, input.height);
  try {
    while (carver.width() > targetWidth) carver.step_vertical();
    while (carver.height() > targetHeight) carver.step_horizontal();
    return carver.rgb();
  } finally {
    carver.free();
  }
}

let failed = 0;
const names = readdirSync(goldens).filter((f) => f.endsWith('.in')).map((f) => f.slice(0, -3)).sort();
if (names.length < 9) throw new Error(`only ${names.length} goldens in ${goldens}`);
for (const name of names) {
  const input = readImage(join(goldens, `${name}.in`));
  const expected = readImage(join(goldens, `${name}.out`));
  const actual = carve(input, expected.width, expected.height);
  const differing = [];
  for (let i = 0; i < expected.rgb.length; i++) {
    if (actual[i] !== expected.rgb[i]) differing.push(i);
  }
  if (actual.length !== expected.rgb.length || differing.length > 0) {
    failed++;
    const first = differing.slice(0, 5).map((i) => {
      const hex = (p) => p.toString(16).padStart(6, '0');
      return `(${i % expected.width}, ${Math.floor(i / expected.width)}): ${hex(actual[i])} != ${hex(expected.rgb[i])}`;
    });
    console.log(`FAIL ${name}: ${differing.length} of ${expected.rgb.length} pixels differ, first: ${first.join(', ')}`);
  } else {
    console.log(`ok   ${name} (${input.width}x${input.height} -> ${expected.width}x${expected.height})`);
  }
}

// GoldenWriter's NOISY_GRADIENT at any size, as benches/carve.rs draws it
function noisyGradient(width, height, seed) {
  let state = BigInt(seed);
  const rgb = new Uint32Array(width * height);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      state = (state * 1103515245n + 12345n) & 0x7fffffffn;
      const noise = Number((state >> 16n) % 64n) - 32;
      const r = clamp(Math.floor((x * 255) / width) + noise);
      const g = clamp(Math.floor((y * 255) / height) - noise);
      const b = clamp(Math.floor(((x + y) * 255) / (width + height)) + Math.trunc(noise / 2));
      rgb[y * width + x] = (r << 16) | (g << 8) | b;
    }
  }
  return rgb;
}

function time(name, width, height) {
  const input = { width, height, rgb: noisyGradient(width, height, 7) };
  const target = Math.floor((width * 3) / 4);
  const seams = width - target;
  const start = performance.now();
  const out = carve(input, target, height);
  const ms = performance.now() - start;
  if (out.length !== target * height) throw new Error(`${name}: ${out.length} pixels`);
  const cells = ((width + target) / 2) * height * seams;
  console.log(`${name}: ${width}x${height} -> ${target}x${height} (${seams} seams) in ${(ms / 1000).toFixed(2)} s, ${((ms * 1e6) / cells).toFixed(2)} ns per pixel-seam`);
}

if (args.includes('--bench')) {
  time('1 MP', 1152, 868);
  if (!args.includes('--quick')) time('12 MP', 4000, 3000);
}

if (failed > 0) {
  console.log(`${failed} of ${names.length} goldens FAILED`);
  process.exit(1);
}
console.log(`${names.length} goldens match`);
