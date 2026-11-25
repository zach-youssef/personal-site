// The seam carver's worker: carves one image per start message (see protocol.ts) on the engine it
// names, off the page's thread. Engines load once per worker and stay loaded for the next carve;
// the page terminates the worker to cancel, after an error, and as it unmounts.
import { runCarve } from './carveJob';
import { encodePng } from './decode';
import { importUrl, LoadedEngine, loadEngine } from './loadEngine';
import { Engine, StartMessage, Variant } from './protocol';

// The worker's global scope (the type check uses the DOM's types, not the webworker library's,
// which clash with them)
const scope = self as unknown as {
    location: { href: string },
    onmessage: ((event: MessageEvent<StartMessage>) => void) | null,
    postMessage(message: unknown, transfer: Transferable[]): void,
};

const loaded = new Map<string, Promise<LoadedEngine>>();

function load(engine: Engine, variant: Variant | undefined): Promise<LoadedEngine> {
    const key = `${engine}/${variant ?? ''}`;
    let engineLoad = loaded.get(key);
    if (!engineLoad) {
        engineLoad = loadEngine(engine, variant, {
            base: scope.location.href,
            fetch: (input, init) => fetch(input, init),
            importModule: importUrl,
            warn: message => console.warn(message),
        });
        // A failed load is retried by the next carve
        engineLoad.catch(() => loaded.delete(key));
        loaded.set(key, engineLoad);
    }
    return engineLoad;
}

scope.onmessage = (event: MessageEvent<StartMessage>) => {
    runCarve(event.data, {
        load,
        post: (message, transfer) => scope.postMessage(message, transfer ?? []),
        now: () => performance.now(),
        encode: encodePng,
    });
};
