import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeamCarverView from './SeamCarverView';
import { FrameMessage, ViewMessage, ViewReply } from './engine/protocol';
import { viewFailedMessage } from './useSeamView';

// jsdom has no 2D canvas: drawing records what it drew
const drawn = vi.hoisted(() => [] as { width: number, height: number, rgb: Int32Array }[]);
vi.mock('./engine/decode', () => ({
    drawPixels: (canvas: HTMLCanvasElement, pixels: { width: number, height: number, rgb: Int32Array }) => {
        canvas.width = pixels.width;
        canvas.height = pixels.height;
        drawn.push(pixels);
    },
}));

// A worker that answers like the view's Rust engine, a tick later unless held: the image shrinks a
// pixel per step, its energy map is grey 0x070707 and every seam is at column (row) 0
class FakeViewWorker {
    static instances: FakeViewWorker[] = [];
    onmessage: ((event: MessageEvent<ViewReply>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    sent: ViewMessage[] = [];
    terminated = false;
    // Replies not delivered yet, when holding
    held: ViewReply[] = [];
    hold = false;
    private width = 0;
    private height = 0;
    private removed = 0;

    constructor() {
        FakeViewWorker.instances.push(this);
    }

    postMessage(message: ViewMessage) {
        this.sent.push(message);
        if (message.type === 'view-begin') {
            [this.width, this.height, this.removed] = [message.width, message.height, 0];
        } else if (message.type === 'view-step') {
            if (message.direction === 'vertical') this.width--;
            else this.height--;
            this.removed++;
        }
        const reply: FrameMessage = {
            type: 'frame', session: message.session, width: this.width, height: this.height, layer: message.layer,
            pixels: new Int32Array(this.width * this.height).fill(message.layer === 'energy' ? 0x070707 : 5),
            removed: this.removed,
            seam: message.seam && {
                direction: message.seam,
                positions: new Uint32Array(message.seam === 'vertical' ? this.height : this.width),
            },
        };
        if (this.hold) this.held.push(reply);
        else setTimeout(() => this.deliver(reply));
    }

    deliver(reply: ViewReply) {
        act(() => this.onmessage?.({ data: reply } as MessageEvent<ViewReply>));
    }

    release() {
        const replies = this.held;
        this.held = [];
        replies.forEach(reply => this.deliver(reply));
    }

    terminate() {
        this.terminated = true;
    }
}

const makeWorker = () => new FakeViewWorker() as unknown as Worker;
const worker = () => FakeViewWorker.instances[FakeViewWorker.instances.length - 1];
const image = { width: 4, height: 3, rgb: new Int32Array(12).fill(5) };
const status = () => document.getElementById('seamCarverViewStatus')!.textContent;
const seamSquares = () => screen.queryByTestId('seamCarverNextSeam')?.querySelector('path')?.getAttribute('d')
    ?.match(/M/g)?.length ?? 0;

function setReducedMotion(reduce: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: reduce && query === '(prefers-reduced-motion: reduce)',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    }));
}

describe('SeamCarverView', () => {
    beforeEach(() => {
        drawn.length = 0;
        FakeViewWorker.instances = [];
        setReducedMotion(false);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    const renderView = (target = { width: 2, height: 2 }) =>
        render(<SeamCarverView image={image} target={target} makeWorker={makeWorker}/>);

    it('draws the input itself, without starting a worker', () => {
        renderView();
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Step through the carve');
        expect(screen.getByRole('img', { name: 'Image being carved, 4 × 3 px' })).toBeInTheDocument();
        expect(drawn[drawn.length - 1]).toBe(image);
        expect(status()).toBe('4 × 3 px, 0 seams removed. Next: a vertical seam.');
        expect(FakeViewWorker.instances).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled();
    });

    it('steps a seam at a time: every vertical seam, then the horizontal ones, then stops at the target', async () => {
        renderView();
        const stepButton = screen.getByRole('button', { name: 'Step' });
        await userEvent.click(stepButton);
        // The first step sends the image, then the step
        expect(worker().sent.map(m => m.type)).toEqual(['view-begin', 'view-step']);
        await waitFor(() => expect(status()).toBe('3 × 3 px, 1 seam removed. Next: a vertical seam.'));
        expect(drawn[drawn.length - 1]).toMatchObject({ width: 3, height: 3 });

        await userEvent.click(stepButton);
        await waitFor(() => expect(status()).toBe('2 × 3 px, 2 seams removed. Next: a horizontal seam.'));
        await userEvent.click(stepButton);
        await waitFor(() => expect(status()).toBe('2 × 2 px, 3 seams removed. At the target size.'));
        expect(stepButton).toBeDisabled();
        expect(worker().sent.filter(m => m.type === 'view-step').map(m => m.type === 'view-step' && m.direction))
            .toEqual(['vertical', 'vertical', 'horizontal']);
    });

    it("doesn't step again while a step's frame is still coming", async () => {
        renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        worker().hold = true;
        await waitFor(() => expect(status()).toContain('1 seam removed'));
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        expect(screen.getByRole('button', { name: 'Step' })).toBeDisabled();
        worker().release();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled());
    });

    it('overlays the next seam: one pixel per row while removing columns, one per column after', async () => {
        renderView();
        await userEvent.click(screen.getByLabelText('Show the next seam'));
        await waitFor(() => expect(seamSquares()).toBe(3));
        expect(worker().sent[0]).toMatchObject({ type: 'view-begin', seam: 'vertical' });

        // The step's frame carries the seam after it: still vertical, then horizontal
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        await waitFor(() => expect(status()).toContain('1 seam removed'));
        expect(worker().sent[1]).toMatchObject({ type: 'view-step', direction: 'vertical', seam: 'vertical' });
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        await waitFor(() => expect(status()).toContain('2 seams removed'));
        expect(worker().sent[2]).toMatchObject({ type: 'view-step', direction: 'vertical', seam: 'horizontal' });
        // A 2 x 3 image's horizontal seam: a row per column
        expect(seamSquares()).toBe(2);

        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        await waitFor(() => expect(status()).toContain('At the target size'));
        // Nothing left to remove
        expect(seamSquares()).toBe(0);

        await userEvent.click(screen.getByLabelText('Show the next seam'));
        expect(screen.queryByTestId('seamCarverNextSeam')).not.toBeInTheDocument();
    });

    it('switches to the energy map and back', async () => {
        renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
        expect(screen.getByRole('button', { name: 'Energy' })).toHaveAttribute('aria-pressed', 'true');
        await screen.findByRole('img', { name: 'Energy map, 4 × 3 px' });
        expect(drawn[drawn.length - 1].rgb[0]).toBe(0x070707);
        // A step keeps the layer
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        await screen.findByRole('img', { name: 'Energy map, 3 × 3 px' });
        expect(worker().sent[1]).toMatchObject({ type: 'view-step', layer: 'energy' });

        // The label names what is drawn, so it changes with the frame, not the button
        worker().hold = true;
        await userEvent.click(screen.getByRole('button', { name: 'Image' }));
        expect(screen.getByRole('img', { name: 'Energy map, 3 × 3 px' })).toBeInTheDocument();
        worker().release();
        await screen.findByRole('img', { name: 'Image being carved, 3 × 3 px' });
        expect(worker().sent[2]).toMatchObject({ type: 'view-show', layer: 'image' });
        expect(drawn[drawn.length - 1].rgb[0]).toBe(5);
    });

    it('plays to the target a step per animation frame, and pauses', async () => {
        renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Play' }));
        expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
        // Quiet for screen readers while it plays
        expect(document.getElementById('seamCarverViewStatus')).toHaveAttribute('aria-live', 'off');
        await waitFor(() => expect(status()).toBe('2 × 2 px, 3 seams removed. At the target size.'));
        expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
        expect(document.getElementById('seamCarverViewStatus')).toHaveAttribute('aria-live', 'polite');

        await userEvent.click(screen.getByRole('button', { name: 'Start over' }));
        expect(status()).toBe('4 × 3 px, 0 seams removed. Next: a vertical seam.');
        worker().hold = true;
        await userEvent.click(screen.getByRole('button', { name: 'Play' }));
        await waitFor(() => expect(worker().held).toHaveLength(2));
        await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
        worker().release();
        await waitFor(() => expect(status()).toContain('1 seam removed'));
        // Paused after the step it had asked for
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(worker().sent.filter(m => m.type === 'view-step')).toHaveLength(4);
    });

    it('hides Play when the visitor prefers reduced motion, leaving Step', () => {
        setReducedMotion(true);
        renderView();
        expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled();
    });

    it('starts again from the input when the target changes, and asks for one when there is none', async () => {
        const { rerender } = renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        await waitFor(() => expect(status()).toContain('1 seam removed'));

        rerender(<SeamCarverView image={image} target={{ width: 4, height: 1 }} makeWorker={makeWorker}/>);
        expect(status()).toBe('4 × 3 px, 0 seams removed. Next: a horizontal seam.');
        expect(drawn[drawn.length - 1]).toBe(image);
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        // The same worker, the image sent again
        expect(FakeViewWorker.instances).toHaveLength(1);
        expect(worker().sent.slice(2).map(m => m.type)).toEqual(['view-begin', 'view-step']);
        await waitFor(() => expect(status()).toBe('4 × 2 px, 1 seam removed. Next: a horizontal seam.'));

        rerender(<SeamCarverView image={image} target={undefined} makeWorker={makeWorker}/>);
        expect(status()).toBe('Choose a target size above to step through its seams.');
        expect(screen.getByRole('button', { name: 'Step' })).toBeDisabled();
    });

    it("doesn't send the image again for a new target before a seam is removed", async () => {
        const { rerender } = renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
        await screen.findByRole('img', { name: 'Energy map, 4 × 3 px' });
        // Typing a size, a digit at a time; a new target object every render, as the page makes
        for (const width of [1, 3, 2]) {
            rerender(<SeamCarverView image={image} target={{ width, height: 2 }} makeWorker={makeWorker}/>);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(worker().sent.map(m => m.type)).toEqual(['view-begin']);
        expect(screen.getByRole('img', { name: 'Energy map, 4 × 3 px' })).toBeInTheDocument();
    });

    it("waits for an abandoned view's replies before sending the next, so they can't queue up", async () => {
        const { rerender } = renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        await waitFor(() => expect(status()).toContain('1 seam removed'));
        worker().hold = true;
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        // A new size while that step is in the worker: the view starts again, but sends nothing yet
        for (const width of [1, 3]) {
            rerender(<SeamCarverView image={image} target={{ width, height: 2 }} makeWorker={makeWorker}/>);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(status()).toBe('4 × 3 px, 0 seams removed. Next: a vertical seam.');
        expect(worker().sent.slice(2).map(m => m.type)).toEqual(['view-step']);
        expect(screen.getByRole('button', { name: 'Step' })).toBeDisabled();

        worker().hold = false;
        worker().release();
        // The abandoned step's frame isn't shown; the input's energy map is asked for once it's in
        await screen.findByRole('img', { name: 'Energy map, 4 × 3 px' });
        expect(worker().sent.slice(2).map(m => m.type)).toEqual(['view-step', 'view-begin']);
        expect(status()).toBe('4 × 3 px, 0 seams removed. Next: a vertical seam.');
        expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled();
    });

    it('drops the worker for a new image, ignoring what the old one still sends', async () => {
        const { rerender } = renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        const old = worker();
        old.hold = true;
        await waitFor(() => expect(status()).toContain('1 seam removed'));
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));

        const other = { width: 5, height: 5, rgb: new Int32Array(25) };
        rerender(<SeamCarverView image={other} target={{ width: 2, height: 2 }} makeWorker={makeWorker}/>);
        expect(old.terminated).toBe(true);
        old.release();
        expect(status()).toBe('5 × 5 px, 0 seams removed. Next: a vertical seam.');
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        expect(worker()).not.toBe(old);
        await waitFor(() => expect(status()).toBe('4 × 5 px, 1 seam removed. Next: a vertical seam.'));
    });

    it('shows a failure, drops the worker, and tries again when the visitor acts', async () => {
        renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Step' }));
        const failing = worker();
        failing.hold = true;
        await waitFor(() => expect(failing.sent).toHaveLength(2));
        failing.deliver({ type: 'view-error', session: (failing.sent[0] as { session: number }).session, message: 'error 404' });
        expect(screen.getByRole('alert')).toHaveTextContent(viewFailedMessage('error 404'));
        expect(failing.terminated).toBe(true);
        expect(status()).toContain('0 seams removed');

        // A layer switch after the failure starts again on a fresh worker
        await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(worker()).not.toBe(failing);
        await screen.findByRole('img', { name: 'Energy map, 4 × 3 px' });
    });

    it("doesn't retry by itself after a failure, even where the view needs a frame", async () => {
        renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
        const failing = worker();
        failing.hold = true;
        failing.deliver({ type: 'view-error', session: (failing.sent[0] as { session: number }).session, message: 'trap' });
        expect(screen.getByRole('alert')).toHaveTextContent(viewFailedMessage('trap'));
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(FakeViewWorker.instances).toEqual([failing]);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('ends its worker when it unmounts', async () => {
        const { unmount } = renderView();
        await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
        await screen.findByRole('img', { name: 'Energy map, 4 × 3 px' });
        act(() => unmount());
        expect(worker().terminated).toBe(true);
    });
});
