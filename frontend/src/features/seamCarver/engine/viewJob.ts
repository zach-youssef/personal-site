import { errorMessage } from './carveJob';
import { RustEngine, ViewCarver } from './loadEngine';
import { FrameMessage, FrameRequest, ViewMessage, ViewReply } from './protocol';

export interface ViewDeps {
    load(): Promise<RustEngine>,
    // transfer: buffers to hand over rather than copy
    post(message: ViewReply, transfer?: Transferable[]): void,
}

// The energy map's grey levels as 0x00RRGGBB, grey in every channel (as toEnergyImage draws them)
export function greyPixels(grey: Uint8Array): Int32Array {
    const pixels = new Int32Array(grey.length);
    for (let i = 0; i < grey.length; i++) pixels[i] = grey[i] * 0x010101;
    return pixels;
}

// The worker's side of the visualisation: one image at a time on the Rust engine, stepped a seam
// per message, each answered with a frame (or an error). Messages are handled in the order they
// arrive, each after the previous one has finished.
export class ViewSession {
    private carver?: ViewCarver;
    private removed = 0;
    private queue: Promise<void> = Promise.resolve();

    constructor(private deps: ViewDeps) {}

    handle(message: ViewMessage): Promise<void> {
        this.queue = this.queue.then(() => this.run(message));
        return this.queue;
    }

    private async run(message: ViewMessage): Promise<void> {
        try {
            if (message.type === 'view-begin') {
                const engine = await this.deps.load();
                this.end();
                this.carver = engine.begin(message.rgb, message.width, message.height);
                this.removed = 0;
            } else if (!this.carver) {
                throw new Error('No image to show');
            } else if (message.type === 'view-step') {
                if (message.direction === 'vertical') this.carver.stepVertical();
                else this.carver.stepHorizontal();
                this.removed++;
            }
            this.post(this.carver, message);
        } catch (e) {
            // A trapped engine refuses every later call: start again from a fresh begin
            this.end();
            this.deps.post({ type: 'view-error', session: message.session, message: errorMessage(e) });
        }
    }

    private post(carver: ViewCarver, request: FrameRequest) {
        const seam = request.seam && {
            direction: request.seam,
            positions: request.seam === 'vertical' ? carver.nextVerticalSeam() : carver.nextHorizontalSeam(),
        };
        const pixels = request.layer === 'energy' ? greyPixels(carver.energyMap()) : carver.result();
        const frame: FrameMessage = {
            type: 'frame',
            session: request.session,
            width: carver.width(),
            height: carver.height(),
            layer: request.layer,
            pixels,
            removed: this.removed,
            seam,
        };
        this.deps.post(frame, seam ? [pixels.buffer, seam.positions.buffer] : [pixels.buffer]);
    }

    private end() {
        try {
            this.carver?.end();
        } catch {
            // A trapped engine may refuse this too
        }
        this.carver = undefined;
    }
}
