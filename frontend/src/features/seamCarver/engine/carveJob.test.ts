import { describe, expect, it, vi } from 'vitest';
import { errorMessage, isOutOfMemory, PROGRESS_INTERVAL_MS, runCarve } from './carveJob';
import { LoadedEngine, StepCarver } from './loadEngine';
import { StartMessage, Variant, WorkerMessage } from './protocol';

// An engine that removes the last column or row, logging each call
function fakeEngine(variant: Variant, options: { failOn?: number, error?: unknown } = {}) {
    const calls: string[] = [];
    const engine: LoadedEngine = {
        variant,
        begin(rgb, width, height): StepCarver {
            calls.push(`begin ${rgb.length} ${width}x${height}`);
            let w = width, h = height, steps = 0;
            const step = (name: string, shrink: () => void) => {
                calls.push(name);
                if (++steps === options.failOn) throw options.error;
                shrink();
            };
            return {
                width: () => w,
                height: () => h,
                stepVertical: () => step('v', () => w--),
                stepHorizontal: () => step('h', () => h--),
                result: () => new Int32Array(w * h).fill(7),
                end: () => { calls.push('end'); },
            };
        },
    };
    return { engine, calls };
}

const start = (overrides: Partial<StartMessage> = {}): StartMessage => ({
    type: 'start', engine: 'java', rgb: new Int32Array(12), width: 4, height: 3,
    targetWidth: 2, targetHeight: 2, ...overrides,
});

function run(message: StartMessage, engine: LoadedEngine | Error, clock = { t: 0, perCall: 0 }) {
    const posted: WorkerMessage[] = [];
    const transfers: (Transferable[] | undefined)[] = [];
    const load = vi.fn(async () => {
        if (engine instanceof Error) throw engine;
        return engine;
    });
    const done = runCarve(message, {
        load,
        post: (m, transfer) => { posted.push(m); transfers.push(transfer); },
        now: () => (clock.t += clock.perCall),
        encode: ({ width, height }) => Uint8Array.from([width, height]),
    });
    return { done, posted, transfers, load };
}

describe('runCarve', () => {
    it('removes every vertical seam, then every horizontal one, and posts the result', async () => {
        const { engine, calls } = fakeEngine('java-wasm');
        const { done, posted, transfers, load } = run(start({ variant: 'java-wasm' }), engine);
        await done;

        expect(load).toHaveBeenCalledWith('java', 'java-wasm');
        expect(calls).toEqual(['begin 12 4x3', 'v', 'v', 'h', 'end']);
        expect(posted[0]).toEqual({ type: 'progress', done: 0, total: 3 });
        expect(posted.at(-2)).toEqual({ type: 'progress', done: 3, total: 3 });
        const result = posted.at(-1);
        expect(result).toMatchObject({ type: 'done', width: 2, height: 2, variant: 'java-wasm' });
        expect(result?.type === 'done' && Array.from(result.rgb)).toEqual([7, 7, 7, 7]);
        // The result's pixels are handed over, not copied
        // The PNG is encoded in the worker, from the carved pixels
        expect(result?.type === 'done' && Array.from(result.png)).toEqual([2, 2]);
        expect(transfers.at(-1)).toEqual(result?.type === 'done' && [result.rgb.buffer, result.png.buffer]);
    });

    it('posts progress at most every PROGRESS_INTERVAL_MS', async () => {
        const { engine } = fakeEngine('rust');
        // Every clock read advances 10 ms
        const { done, posted } = run(start({ engine: 'rust', width: 100, height: 1, targetWidth: 1, targetHeight: 1 }),
            engine, { t: 0, perCall: 10 });
        await done;

        const progress = posted.filter(m => m.type === 'progress');
        expect(progress[0]).toEqual({ type: 'progress', done: 0, total: 99 });
        expect(progress.at(-1)).toEqual({ type: 'progress', done: 99, total: 99 });
        // 99 steps of 10 ms: one post per PROGRESS_INTERVAL_MS, plus the first and the last
        expect(progress.length).toBeLessThanOrEqual(2 + Math.ceil(99 * 10 / PROGRESS_INTERVAL_MS));
        expect(progress.length).toBeGreaterThan(2);
    });

    it('reports an engine running out of memory, and frees the image', async () => {
        const { engine, calls } = fakeEngine('java-wasm', { failOn: 2, error: new RangeError('Maximum call stack') });
        const { done, posted } = run(start(), engine);
        await done;

        expect(posted.at(-1)).toEqual({
            type: 'error', reason: 'out-of-memory', engine: 'java', message: 'Maximum call stack',
        });
        expect(calls.at(-1)).toBe('end');
    });

    it('reports a WebAssembly trap as running out of memory, with its message', async () => {
        const { engine } = fakeEngine('rust', { failOn: 1, error: new WebAssembly.RuntimeError('unreachable') });
        const { done, posted } = run(start({ engine: 'rust' }), engine);
        await done;

        expect(posted.at(-1)).toEqual({ type: 'error', reason: 'out-of-memory', engine: 'rust', message: 'unreachable' });
    });

    it('reports other failures with their message', async () => {
        const { engine } = fakeEngine('rust', { failOn: 1, error: new Error('boom') });
        const { done, posted } = run(start({ engine: 'rust' }), engine);
        await done;

        expect(posted.at(-1)).toEqual({ type: 'error', reason: 'failed', engine: 'rust', message: 'boom' });
    });

    it('reports the first error when freeing the image fails too', async () => {
        const { engine } = fakeEngine('rust', { failOn: 1, error: new Error('first') });
        const begin = engine.begin;
        engine.begin = (...args) => ({ ...begin(...args), end: () => { throw new Error('second'); } });
        const { done, posted } = run(start({ engine: 'rust' }), engine);
        await done;

        expect(posted.at(-1)).toMatchObject({ type: 'error', message: 'first' });
    });

    it('reports an engine that fails to load', async () => {
        const { done, posted } = run(start(), new Error('404'));
        await done;

        expect(posted).toEqual([{ type: 'error', reason: 'failed', engine: 'java', message: '404' }]);
    });

    it('refuses targets outside the image', async () => {
        for (const target of [{ targetWidth: 0 }, { targetHeight: 4 }, { targetWidth: 5 }]) {
            const { engine, calls } = fakeEngine('rust');
            const { done, posted } = run(start(target), engine);
            await done;
            expect(posted.at(-1)).toMatchObject({ type: 'error', reason: 'failed' });
            expect(calls).toEqual([]);
        }
    });
});

describe('isOutOfMemory', () => {
    it('recognises allocation failures, traps and Java OutOfMemoryErrors', () => {
        expect(isOutOfMemory(new RangeError('Array buffer allocation failed'))).toBe(true);
        expect(isOutOfMemory(new WebAssembly.RuntimeError('unreachable'))).toBe(true);
        expect(isOutOfMemory(new Error('java.lang.OutOfMemoryError'))).toBe(true);
        expect(isOutOfMemory(new Error('OutOfMemory: 12000x9000 needs 1 GB'))).toBe(true);
        expect(isOutOfMemory('out of memory')).toBe(true);
        expect(isOutOfMemory(new Error('the image is one pixel wide'))).toBe(false);
        expect(isOutOfMemory(undefined)).toBe(false);
    });
});

describe('errorMessage', () => {
    it("gives an error's message without its name", () => {
        expect(errorMessage(new Error('boom'))).toBe('boom');
        expect(errorMessage(new WebAssembly.RuntimeError('unreachable'))).toBe('unreachable');
        // Thrown objects that aren't Errors, such as some engines' exceptions
        expect(errorMessage({ message: 'java.lang.IllegalStateException' })).toBe('java.lang.IllegalStateException');
        expect(errorMessage('plain')).toBe('plain');
        expect(errorMessage(undefined)).toBe('undefined');
    });
});
