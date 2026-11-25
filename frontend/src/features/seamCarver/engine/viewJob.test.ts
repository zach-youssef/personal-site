import { describe, expect, it, vi } from 'vitest';
import { RustEngine, ViewCarver } from './loadEngine';
import { FrameMessage, ViewReply } from './protocol';
import { greyPixels, ViewSession } from './viewJob';

// A Rust carver whose image starts w x h and shrinks a pixel per step; its seams are column 0 / row 0
function fakeEngine() {
    const carvers: (ViewCarver & { ended: boolean })[] = [];
    const engine: RustEngine = {
        variant: 'rust',
        begin(rgb, width, height) {
            let w = width, h = height;
            const carver = {
                ended: false,
                width: () => w,
                height: () => h,
                stepVertical: () => {
                    if (w === 1) throw new Error("can't lose another seam");
                    w--;
                },
                stepHorizontal: () => { h--; },
                result: () => new Int32Array(w * h).fill(rgb[0]),
                energyMap: () => new Uint8Array(w * h).fill(7),
                nextVerticalSeam: () => new Uint32Array(h),
                nextHorizontalSeam: () => new Uint32Array(w),
                end: () => { carver.ended = true; },
            };
            carvers.push(carver);
            return carver;
        },
    };
    return { engine, carvers };
}

function session() {
    const { engine, carvers } = fakeEngine();
    const replies: { message: ViewReply, transfer?: Transferable[] }[] = [];
    const load = vi.fn(async () => engine);
    const view = new ViewSession({ load, post: (message, transfer) => replies.push({ message, transfer }) });
    const frames = () => replies.map(r => r.message).filter((m): m is FrameMessage => m.type === 'frame');
    return { view, carvers, replies, frames, load };
}

const rgb = Int32Array.from({ length: 12 }, () => 0x123456);

describe('greyPixels', () => {
    it('puts each grey level in every channel', () => {
        expect(Array.from(greyPixels(Uint8Array.from([0, 1, 255])))).toEqual([0, 0x010101, 0xffffff]);
    });
});

describe('ViewSession', () => {
    it('answers a begin with the image as it is, and steps a seam per step', async () => {
        const { view, frames, replies } = session();
        await view.handle({ type: 'view-begin', session: 1, rgb, width: 4, height: 3, layer: 'image' });
        expect(frames()[0]).toMatchObject({ session: 1, width: 4, height: 3, layer: 'image', removed: 0, seam: undefined });
        expect(Array.from(frames()[0].pixels)).toEqual(Array(12).fill(0x123456));
        // The pixels are handed over, not copied
        expect(replies[0].transfer).toEqual([frames()[0].pixels.buffer]);

        await view.handle({ type: 'view-step', session: 1, direction: 'vertical', layer: 'image', seam: 'vertical' });
        expect(frames()[1]).toMatchObject({ width: 3, height: 3, removed: 1 });
        expect(frames()[1].seam?.direction).toBe('vertical');
        // A column per row
        expect(frames()[1].seam?.positions).toHaveLength(3);

        await view.handle({ type: 'view-step', session: 1, direction: 'horizontal', layer: 'energy', seam: 'horizontal' });
        expect(frames()[2]).toMatchObject({ width: 3, height: 2, removed: 2, layer: 'energy' });
        // A row per column
        expect(frames()[2].seam?.positions).toHaveLength(3);
        expect(Array.from(frames()[2].pixels)).toEqual(Array(6).fill(0x070707));
    });

    it('redraws without stepping on a show', async () => {
        const { view, frames } = session();
        await view.handle({ type: 'view-begin', session: 1, rgb, width: 4, height: 3, layer: 'image' });
        await view.handle({ type: 'view-show', session: 1, layer: 'energy', seam: 'vertical' });
        expect(frames()[1]).toMatchObject({ width: 4, height: 3, removed: 0, layer: 'energy' });
        expect(frames()[1].seam?.positions).toHaveLength(3);
    });

    it('handles messages in order, each after the engine has loaded', async () => {
        const { view, frames } = session();
        view.handle({ type: 'view-begin', session: 1, rgb, width: 4, height: 3, layer: 'image' });
        await view.handle({ type: 'view-step', session: 1, direction: 'vertical', layer: 'image' });
        expect(frames().map(f => f.width)).toEqual([4, 3]);
    });

    it('drops the previous image on a new begin, and restarts the count', async () => {
        const { view, frames, carvers } = session();
        await view.handle({ type: 'view-begin', session: 1, rgb, width: 4, height: 3, layer: 'image' });
        await view.handle({ type: 'view-step', session: 1, direction: 'vertical', layer: 'image' });
        await view.handle({ type: 'view-begin', session: 2, rgb, width: 4, height: 3, layer: 'image' });
        expect(carvers[0].ended).toBe(true);
        expect(frames()[2]).toMatchObject({ session: 2, width: 4, removed: 0 });
    });

    it('reports a failed step and needs a new begin after it', async () => {
        const { view, replies, carvers } = session();
        await view.handle({ type: 'view-begin', session: 3, rgb: Int32Array.of(1), width: 1, height: 1, layer: 'image' });
        await view.handle({ type: 'view-step', session: 3, direction: 'vertical', layer: 'image' });
        expect(replies[1].message).toEqual({ type: 'view-error', session: 3, message: "can't lose another seam" });
        expect(carvers[0].ended).toBe(true);
        await view.handle({ type: 'view-show', session: 3, layer: 'image' });
        expect(replies[2].message).toEqual({ type: 'view-error', session: 3, message: 'No image to show' });
    });

    it("reports an engine that doesn't load", async () => {
        const { view, replies, load } = session();
        load.mockRejectedValueOnce(new Error('error 404'));
        await view.handle({ type: 'view-begin', session: 1, rgb, width: 4, height: 3, layer: 'image' });
        expect(replies[0].message).toEqual({ type: 'view-error', session: 1, message: 'error 404' });
    });
});
