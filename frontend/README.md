# zyoussef.com Frontend Code

## Building and running

```
npm run start
```

## Bootstrap and react-bootstrap

The themes in `src/theme` compile Bootstrap 5.3's Sass, and the components use react-bootstrap 2. Two behaviours differ from what the markup suggests:

- **`<Button href>` renders `role="button"`.** A link drawn as a button would be announced as an action and missed by `getByRole('link')`, so use `ButtonLink` (a plain `<a class="btn ...">`).
- **`Dropdown.Item`'s `onSelect` fires only through a Dropdown-level `onSelect`.** Put a handler on the item itself in `onClick`.

## Component tests

```
npm test
```

runs the type check, then Vitest on every `src/**/*.test.{ts,tsx}` in jsdom (`npm run test:watch` reruns on changes). Testing Library unmounts what a test rendered through Vitest's global `afterEach` (`globals: true` in `vite.config.ts`), which runs after the `afterEach` hooks of a test file's `describe` blocks. Two traps follow from jsdom and from that order:

- **jsdom has no object URLs.** `URL.createObjectURL` and `URL.revokeObjectURL` don't exist, so a component that makes and revokes them (image_filter's demo) needs them defined in `beforeEach` (`Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(...) })`) and deleted again in `afterEach`. Call Testing Library's `cleanup()` first in that `afterEach`: a component revokes its URLs as it unmounts, and the global cleanup would unmount it only after the stubs are gone.
- **Module-level state outlives a test.** State kept at a module's top level is shared by every test in the file. `ZgalCanvas` and `ImageFilterDemo` chain each program's start on the stop of the one before (each has its own WebGPU device), so a fake program whose stop a test holds pending holds up every later test's run. Record each fake's release in a list the file owns, and in `afterEach` call `cleanup()` (whose unmounts stop the programs), then release every held stop (see `ZgalCanvas.test.tsx` and the image filter's tests in `ProjectPages.test.tsx`).

## Web workers

The seam carver (`src/features/seamCarver/`) carves on a worker, so a carve of many seconds never blocks the page. Its pattern, for any feature that needs one:

- **Vite builds the worker** from `new Worker(new URL('./engine/carve.worker.ts', import.meta.url), { type: 'module' })`, which must appear literally in the source (Vite finds workers by that expression; here it is `createCarveWorker` in `useSeamCarver.ts`). `worker.format` is `"es"` in `vite.config.ts`, so workers are module workers and can `import()` modules at run time.
- **Code loaded at run time** (the engines the backend serves under `/assets/seamcarver-web/`, named by `manifest.json`, which is read afresh each time a worker loads an engine) goes through `import(/* @vite-ignore */ url)`, which Vite leaves alone (`importUrl` in `engine/loadEngine.ts`).
- **The protocol** is a module of message types (`engine/protocol.ts`) both sides import. The worker's logic is a plain module with its surroundings passed in (`engine/carveJob.ts` takes `load`, `post` and `now`; `engine/loadEngine.ts` takes `fetch` and `importModule`), so Vitest tests it directly; the worker file itself (`carve.worker.ts`) only wires `onmessage` to it. The type check uses the DOM's types, whose `self` is a `Window`, so the worker casts `self` to the few members it uses rather than adding the `webworker` library, which clashes with `dom`.
- **The page owns the worker's life** (`useSeamCarver.ts`): it keeps the worker after a carve, so the next one reuses the engines it loaded (except after an image larger than the Java takes, since WebAssembly memory never shrinks), and terminates it to cancel (nothing else stops a loop that never yields, such as the Java's), after an error (a trapped WebAssembly instance can't be reused; a worker that dies of running out of memory, as Firefox's do, arrives as its `error` event and is treated like the engine's own out-of-memory error), and on unmount; the next carve starts a fresh one. A handler ignores messages from a worker the page has since replaced. Large buffers going back are transferred (`postMessage(message, [buffer])`); the input is copied, since the page keeps it to rerun a carve on the other engine.
- **Pixels never come back from a canvas.** Browsers with fingerprinting protection (Brave by default, Safari's and Firefox's private windows) add noise to what `getImageData` and `toBlob` read, so the seam carver decodes PNGs and encodes its download (in the worker, so a large result doesn't stall the page) with `fast-png` (`engine/decode.ts`) and uses a canvas only to show the result (and to decode formats other than PNG). Its tests (`engine/decode.test.ts`) decode and encode with no canvas at all.
- **Tests** stub the global `Worker` with a fake that records what the page posts and whether it was terminated, and delivers the worker's messages on demand (`SeamCarverPage.test.tsx`). jsdom has no `createImageBitmap` and no 2D canvas, so the page's decoding and drawing live in one module (`engine/decode.ts`) that the tests replace with `vi.mock`. The end-to-end tests run the real worker and engines (`e2e/tests/seamCarver.spec.ts`); `?engine=java-wasm|java-js|rust` on the page's URL forces an engine variant for them.
