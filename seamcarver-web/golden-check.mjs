#!/usr/bin/env node
// Checks a build of the seam carver's web engines (what ./build-seamcarver puts in
// graphql-server/assets/seamcarver-web) against the goldens in testdata/seamcarver, under Node:
// every engine the build's manifest.json names carves every case, and any differing pixel fails
// the check (exit 1). It also checks that each file the manifest names is there under a name that
// carries its content's hash (<stem>.<first 16 hex digits of the sha256>.<ext>), since browsers
// cache the files by name.
//
//   node --experimental-wasm-exnref golden-check.mjs <built dir>
//
// The flag is for Node 24, whose V8 has the exception-handling proposal TeaVM's WebAssembly uses
// (exnref) behind it; a Node that has it on by default needs none.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = process.argv[2];
if (!dir || process.argv.length !== 3) {
  console.error('usage: node --experimental-wasm-exnref golden-check.mjs <built dir>');
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
const goldens = join(here, '..', 'testdata', 'seamcarver');

const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
let failed = 0;
const fail = (message) => {
  failed++;
  console.log(`FAIL ${message}`);
};

// Every file the manifest names must be there, named by its content's hash
const files = Object.values(manifest).flatMap((engine) => Object.values(engine));
for (const path of files) {
  const named = /\.([0-9a-f]{16})\.[^./]+$/.exec(path)?.[1];
  const actual = createHash('sha256').update(readFileSync(resolve(dir, path))).digest('hex');
  if (!named) fail(`${path}: the name carries no hash`);
  else if (!actual.startsWith(named)) fail(`${path}: named by ${named}, but its sha256 is ${actual}`);
}
const file = (path) => resolve(dir, path);

// A .in or .out file: little-endian int32 width and height, then 0x00RRGGBB int32 pixels
function readImage(path) {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getInt32(0, true);
  const height = view.getInt32(4, true);
  if (bytes.byteLength !== 8 + 4 * width * height) throw new Error(`${path}: size`);
  const rgb = new Int32Array(width * height);
  for (let i = 0; i < rgb.length; i++) rgb[i] = view.getInt32(8 + 4 * i, true);
  return { width, height, rgb };
}

// The engines, each as { name, carve(input, targetWidth, targetHeight) -> pixels }. The carve loops
// are the worker's: all vertical seams, then all horizontal ones, through the stepwise exports.
const engines = [];

// The Java (WebCarver's static exports), in both of TeaVM's builds
function javaEngine(name, exports) {
  return {
    name,
    carve(input, targetWidth, targetHeight) {
      exports.begin(input.rgb, input.width, input.height);
      try {
        while (exports.width() > targetWidth) exports.stepVertical();
        while (exports.height() > targetHeight) exports.stepHorizontal();
        return Int32Array.from(exports.result());
      } finally {
        exports.end();
      }
    },
  };
}
{
  const runtime = await import(pathToFileURL(file(manifest.java.wasmRuntime)).href);
  const wasmPath = file(manifest.java.wasm);
  let teavm;
  try {
    teavm = await runtime.load(wasmPath);
  } catch (e) {
    if (e instanceof WebAssembly.CompileError) {
      console.error(`Node can't compile ${wasmPath}: run with --experimental-wasm-exnref (Node 24)\n  ${e.message}`);
      process.exit(2);
    }
    throw e;
  }
  engines.push(javaEngine('Java, WebAssembly (TeaVM)', teavm.exports));
  engines.push(javaEngine('Java, JavaScript (TeaVM)', await import(pathToFileURL(file(manifest.java.js)).href)));
}

const names = readdirSync(goldens).filter((f) => f.endsWith('.in')).map((f) => f.slice(0, -3)).sort();
if (names.length < 12) throw new Error(`only ${names.length} goldens in ${goldens}`);
for (const engine of engines) {
  for (const name of names) {
    const input = readImage(join(goldens, `${name}.in`));
    const expected = readImage(join(goldens, `${name}.out`));
    const start = performance.now();
    const actual = engine.carve(input, expected.width, expected.height);
    const ms = performance.now() - start;
    const differing = [];
    for (let i = 0; i < expected.rgb.length; i++) {
      if (actual[i] !== expected.rgb[i]) differing.push(i);
    }
    if (actual.length !== expected.rgb.length || differing.length > 0) {
      const hex = (p) => (p >>> 0).toString(16).padStart(6, '0');
      const first = differing.slice(0, 5).map((i) =>
        `(${i % expected.width}, ${Math.floor(i / expected.width)}): ${hex(actual[i])} != ${hex(expected.rgb[i])}`);
      fail(`${engine.name}, ${name}: ${actual.length} pixels for ${expected.rgb.length}, ${differing.length} differ, first: ${first.join(', ')}`);
    } else {
      console.log(`ok   ${engine.name}, ${name} (${input.width}x${input.height} -> ${expected.width}x${expected.height}, ${ms.toFixed(0)} ms)`);
    }
  }
}

if (failed > 0) {
  console.log(`${failed} check(s) FAILED`);
  process.exit(1);
}
console.log(`${engines.length} engines match all ${names.length} goldens; ${files.length} files named by their hashes`);
