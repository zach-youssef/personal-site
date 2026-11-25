# zyoussef.com Frontend Code

## Building and running

```
npm run start
```

## Bootstrap and react-bootstrap

The themes in `src/theme` compile Bootstrap 5.3's Sass, and the components use react-bootstrap 2. Three behaviours differ from what the markup suggests:

- **`<Button href>` renders `role="button"`.** A link drawn as a button would be announced as an action and missed by `getByRole('link')`, so use `ButtonLink` (a plain `<a class="btn ...">`).
- **`Dropdown.Item`'s `onSelect` fires only through a Dropdown-level `onSelect`.** Put a handler on the item itself in `onClick`.
- **`<ProgressBar now aria-label>` puts the label on the outer `.progress` box**, while the inner bar has `role="progressbar"`, so the progressbar has no name. Nest one: `<ProgressBar><ProgressBar now aria-label/></ProgressBar>` (a child takes the props itself), as the seam carver page does, or write the markup out (the splat page).

## TypeScript and module resolution

The type check targets ES2022 with `"bundler"` resolution (`tsconfig.json`); Vite and Vitest compile with esbuild and don't type-check.

- **`vite-tsconfig-paths` applies `tsconfig.json`'s `paths` to Vite's and Vitest's resolution too**, not just the type check. A `paths` entry that points a package at a `.d.ts` (to find types the package doesn't expose) makes the runtime import load that `.d.ts`: give the types with an ambient `declare module '<package>'` in a `.d.ts` under `src/` instead.
- **Class fields have define semantics** (`useDefineForClassFields` is on for ES2022). A subclass that redeclares a base class's field without initialising it resets that field to `undefined` after `super()`; declare it with `declare` or don't redeclare it (the WebGL scene graph nodes and `CanonicalMesh` initialise only their own fields).

## Component tests

```
npm test
```

runs the type check, then Vitest on every `src/**/*.test.{ts,tsx}` in jsdom (`npm run test:watch` reruns on changes). Testing Library unmounts what a test rendered through Vitest's global `afterEach` (`globals: true` in `vite.config.ts`), which runs after the `afterEach` hooks of a test file's `describe` blocks. `src/setupTests.ts` fails any test that logs to `console.error` or `console.warn`, which is where React logs its warnings. It can't pick out React's own messages, since React 19 prints them with no common prefix; a test that expects an error or a warning mocks the method out with `vi.spyOn(console, 'error').mockImplementation(...)`. These traps follow from jsdom, from that order and from the warnings:

- **jsdom has no object URLs.** `URL.createObjectURL` and `URL.revokeObjectURL` don't exist, so a component that makes and revokes them (image_filter's demo) needs them defined in `beforeEach` (`Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(...) })`) and deleted again in `afterEach`. Call Testing Library's `cleanup()` first in that `afterEach`: a component revokes its URLs as it unmounts, and the global cleanup would unmount it only after the stubs are gone.
- **Module-level state outlives a test.** State kept at a module's top level is shared by every test in the file. `ZgalCanvas` and `ImageFilterDemo` chain each program's start on the stop of the one before (each has its own WebGPU device), so a fake program whose stop a test holds pending holds up every later test's run. Record each fake's release in a list the file owns, and in `afterEach` call `cleanup()` (whose unmounts stop the programs), then release every held stop (see `ZgalCanvas.test.tsx` and the image filter's tests in `ProjectPages.test.tsx`).
- **A state update outside `act()` is a warning.** A component that fetches as it mounts sets its state after the test's synchronous assertions, which React reports as an update not wrapped in `act(...)`. Await the update before the test ends: `findBy*`, or Testing Library's `waitFor` on what the response shows (or on the request having been made, when it shows nothing: `waitFor` lets one macrotask's worth of pending updates land before it returns, which covers `mockGraphQL`'s answers as they settle in microtasks; a fake that answers after a timer needs `waitFor` on what the answer shows). Use Testing Library's `waitFor`, not `vi.waitFor`, which knows nothing of `act()`. A `describe`'s `afterEach` that fires an event a mounted component listens for (a resize) must `cleanup()` first.

## Web workers

The seam carver (`src/features/seamCarver/`) carves on a worker, so a carve of many seconds never blocks the page. Its pattern, for any feature that needs one:

- **Vite builds the worker** from `new Worker(new URL('./engine/carve.worker.ts', import.meta.url), { type: 'module' })`, which must appear literally in the source (Vite finds workers by that expression; here it is `createCarveWorker` in `useSeamCarver.ts`). `worker.format` is `"es"` in `vite.config.ts`, so workers are module workers and can `import()` modules at run time.
- **Code loaded at run time** (the engines the backend serves under `/assets/seamcarver-web/`, named by `manifest.json`, which is read afresh each time a worker loads an engine) goes through `import(/* @vite-ignore */ url)`, which Vite leaves alone (`importUrl` in `engine/loadEngine.ts`).
- **The protocol** is a module of message types (`engine/protocol.ts`) both sides import. The worker's logic is a plain module with its surroundings passed in (`engine/carveJob.ts` takes `load`, `post` and `now`; `engine/loadEngine.ts` takes `fetch` and `importModule`), so Vitest tests it directly; the worker file itself (`carve.worker.ts`) only wires `onmessage` to it. The type check uses the DOM's types, whose `self` is a `Window`, so the worker casts `self` to the few members it uses rather than adding the `webworker` library, which clashes with `dom`.
- **The page owns the worker's life** (`useSeamCarver.ts`): it keeps the worker after a carve, so the next one reuses the engines it loaded (except after an image larger than the Java takes, since WebAssembly memory never shrinks), and terminates it to cancel (nothing else stops a loop that never yields, such as the Java's), after an error (a trapped WebAssembly instance can't be reused; a worker that dies of running out of memory, as Firefox's do, arrives as its `error` event and is treated like the engine's own out-of-memory error), and on unmount; the next carve starts a fresh one. A handler ignores messages from a worker the page has since replaced. Large buffers going back are transferred (`postMessage(message, [buffer])`); the input is copied, since the page keeps it to rerun a carve on the other engine.
- **The visualisation has a worker of its own** (`SeamCarverView.tsx`, `useSeamView.ts`): the same script, answering `view-*` messages (`engine/viewJob.ts`) with frames from the Rust engine (its energy map and seams are the Java's), so cancelling a carve never ends it. It starts on the first control that needs a frame (until then the page draws the input itself), keeps one message in flight (Play asks for the next step once the last frame is in, at most once per animation frame), tags each view with a session number so replies to an older image or target are dropped (a new target starts a new view only once seams have been removed, and nothing more is sent until the old view's replies are in, so abandoned views can't queue up in the worker), and is terminated for a new image, after an error and on unmount. Its seam overlay is one SVG path over the canvas, with a non-scaling stroke so a seam stays visible where a large image is drawn smaller than its pixels.
- **Pixels never come back from a canvas.** Browsers with fingerprinting protection (Brave by default, Safari's and Firefox's private windows) add noise to what `getImageData` and `toBlob` read, so the seam carver decodes PNGs and encodes its download (in the worker, so a large result doesn't stall the page) with `fast-png` (`engine/decode.ts`) and uses a canvas only to show the result (and to decode formats other than PNG). Its tests (`engine/decode.test.ts`) decode and encode with no canvas at all.
- **Tests** stub the global `Worker` with a fake that records what the page posts and whether it was terminated, and delivers the worker's messages on demand (`SeamCarverPage.test.tsx`; `SeamCarverView.test.tsx`'s answers like the Rust engine). jsdom has no `createImageBitmap` and no 2D canvas, so the page's decoding and drawing live in one module (`engine/decode.ts`) that the tests replace with `vi.mock`. The end-to-end tests run the real worker and engines (`e2e/tests/seamCarver.spec.ts`, and `seamCarverView.spec.ts` for the visualisation); `?engine=java-wasm|java-js|rust` on the page's URL forces an engine variant for them.
