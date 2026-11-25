// The seam carver's worker: carves one image per start message (see protocol.ts) on the engine it
// names, off the page's thread, or (on a worker of the visualisation's own) steps through one
// image's seams on the Rust engine, a frame per view message. Engines load once per worker and stay loaded for the next carve;
// the page terminates the worker to cancel, after an error, and as it unmounts.
import { runCarve } from './carveJob';
import { encodePng } from './decode';
import { importUrl, LoadedEngine, loadEngine, RustEngine } from './loadEngine';
import { Engine, StartMessage, Variant, ViewMessage } from './protocol';
import { ViewSession } from './viewJob';

// The worker's global scope (the type check uses the DOM's types, not the webworker library's,
// which clash with them)
const scope = self as unknown as {
    location: { href: string },
    onmessage: ((event: MessageEvent<StartMessage | ViewMessage>) => void) | null,
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

const post = (message: unknown, transfer?: Transferable[]) => scope.postMessage(message, transfer ?? []);

// Made on the first view message, so a carving worker never holds one
let view: ViewSession | undefined;

scope.onmessage = (event: MessageEvent<StartMessage | ViewMessage>) => {
    const message = event.data;
    if (message.type !== 'start') {
        // The Rust engine is the only one that loads as a RustEngine
        view ??= new ViewSession({ load: () => load('rust', undefined) as Promise<RustEngine>, post });
        view.handle(message);
        return;
    }
    runCarve(message, {
        load,
        post,
        now: () => performance.now(),
        encode: encodePng,
    });
};
