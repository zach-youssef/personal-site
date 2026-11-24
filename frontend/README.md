# zyoussef.com Frontend Code

## Building and running

```
npm run start
```

## Component tests

```
npm test
```

runs the type check, then Vitest on every `src/**/*.test.{ts,tsx}` in jsdom (`npm run test:watch` reruns on changes). Testing Library unmounts what a test rendered through Vitest's global `afterEach` (`globals: true` in `vite.config.ts`), which runs after the `afterEach` hooks of a test file's `describe` blocks. Two traps follow from jsdom and from that order:

- **jsdom has no object URLs.** `URL.createObjectURL` and `URL.revokeObjectURL` don't exist, so a component that makes and revokes them (image_filter's demo) needs them defined in `beforeEach` (`Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(...) })`) and deleted again in `afterEach`. Call Testing Library's `cleanup()` first in that `afterEach`: a component revokes its URLs as it unmounts, and the global cleanup would unmount it only after the stubs are gone.
- **Module-level state outlives a test.** State kept at a module's top level is shared by every test in the file. `ZgalCanvas` and `ImageFilterDemo` chain each program's start on the stop of the one before (each has its own WebGPU device), so a fake program whose stop a test holds pending holds up every later test's run. Record each fake's release in a list the file owns, and in `afterEach` call `cleanup()` (whose unmounts stop the programs), then release every held stop (see `ZgalCanvas.test.tsx` and the image filter's tests in `ProjectPages.test.tsx`).
