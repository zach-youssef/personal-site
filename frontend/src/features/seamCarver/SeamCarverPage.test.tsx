import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeamCarverPage, { formatDuration } from './SeamCarverPage';
import { StartMessage, WorkerMessage } from './engine/protocol';
import { OUT_OF_MEMORY_MESSAGE } from './useSeamCarver';

// jsdom decodes no images and has no 2D canvas, so decoding gives sizes keyed by the file's name (an
// unknown name fails to decode), drawing records what it drew, and the PNG is a fixed blob
const imageSizes: Record<string, { width: number, height: number }> = {
    'small.png': { width: 100, height: 80 },
    'other.png': { width: 60, height: 40 },
    // JAVA_MAX_PIXELS exactly, and one pixel over it
    'java-max.png': { width: 96048, height: 1 },
    'java-over.png': { width: 96049, height: 1 },
    'huge.png': { width: 2000, height: 1500 },
};

const decode = vi.hoisted(() => ({
    decodes: [] as string[],
    // Decodes of these names wait until released, to order decodes by hand
    held: {} as Record<string, () => void>,
    // What each draw drew, and the label of the canvas it drew on
    drawn: [] as { width: number, height: number, rgb: Int32Array, label: string | null }[],
}));

vi.mock('./engine/decode', () => ({
    decodePixels: (file: File) => new Promise((resolve, reject) => {
        decode.decodes.push(file.name);
        const size = imageSizes[file.name];
        const finish = () => size
            ? resolve({ ...size, rgb: new Int32Array(size.width * size.height).fill(5) })
            : reject(new Error('not an image'));
        if (file.name in decode.held) decode.held[file.name] = () => setTimeout(finish);
        else setTimeout(finish);
    }),
    drawPixels: (canvas: HTMLCanvasElement, pixels: { width: number, height: number, rgb: Int32Array }) => {
        canvas.width = pixels.width;
        canvas.height = pixels.height;
        decode.drawn.push({ ...pixels, label: canvas.getAttribute('aria-label') });
    },
}));

// A worker the test drives: it records what the page sends and whether it was terminated, and
// emit() delivers a message from the "engine"
class FakeWorker {
    static instances: FakeWorker[] = [];
    onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    sent: StartMessage[] = [];
    terminated = false;

    constructor(public url: URL | string, public options?: WorkerOptions) {
        FakeWorker.instances.push(this);
    }

    postMessage(message: StartMessage) {
        this.sent.push(message);
    }

    terminate() {
        this.terminated = true;
    }

    emit(message: WorkerMessage) {
        act(() => {
            this.onmessage?.({ data: message } as MessageEvent<WorkerMessage>);
        });
    }

    finish(width: number, height: number, variant: 'java-wasm' | 'java-js' | 'rust', ms = 1234) {
        this.emit({
            type: 'done', rgb: new Int32Array(width * height).fill(9), png: Uint8Array.from([0x89, 0x50]),
            width, height, variant, ms,
        });
    }
}

const lastWorker = () => FakeWorker.instances[FakeWorker.instances.length - 1];

const JAVA_WASM_LABEL = 'Carved by the original Java (WebAssembly via TeaVM), in 1.2 s.';
const RUST_LABEL = 'Carved by the Rust engine (WebAssembly), checked pixel-identical to the Java, in 1.2 s.';

describe('SeamCarverPage', () => {
    let revoked: string[];
    let warn: ReturnType<typeof vi.spyOn>;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        decode.decodes = [];
        decode.held = {};
        decode.drawn = [];
        revoked = [];
        FakeWorker.instances = [];
        vi.stubGlobal('Worker', FakeWorker);
        warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        // No carve may reach the server
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        let blobs = 0;
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn((obj: Blob | MediaSource) => obj instanceof File ? `blob:${obj.name}` : `blob:png-${++blobs}`),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn((url: string) => { revoked.push(url); }),
        });
    });

    afterEach(() => {
        // Unmount (which revokes URLs and terminates the worker) while the stubs still exist
        cleanup();
        expect(fetchMock).not.toHaveBeenCalled();
        window.history.replaceState(null, '', '/');
        vi.unstubAllGlobals();
        warn.mockRestore();
        delete (URL as Partial<typeof URL>).createObjectURL;
        delete (URL as Partial<typeof URL>).revokeObjectURL;
    });

    function renderPage() {
        const view = render(<SeamCarverPage />);
        const width = () => screen.getByLabelText('Target Width');
        const height = () => screen.getByLabelText('Target Height');
        return {
            ...view,
            width,
            height,
            fastSwitch: () => screen.getByLabelText('Use the fast engine'),
            async choose(fileName: string) {
                await userEvent.upload(screen.getByLabelText('Image File'),
                    new File(['png'], fileName, { type: 'image/png' }));
            },
            async fill(fileName: string, w: string, h: string) {
                await this.choose(fileName);
                // Wait for the decode, which prefills the targets
                await waitFor(() => expect(width()).not.toHaveValue(null));
                await userEvent.clear(width());
                await userEvent.type(width(), w);
                await userEvent.clear(height());
                await userEvent.type(height(), h);
            },
            submit: () => userEvent.click(screen.getByRole('button', { name: 'Carve' })),
            // Fills in, submits and waits for the carve to reach the worker
            async carve(fileName: string, w: string, h: string) {
                await this.fill(fileName, w, h);
                await this.submit();
                await waitFor(() => expect(lastWorker()?.sent.length).toBeGreaterThan(0));
                return lastWorker();
            },
        };
    }

    it('requires a file and target dimensions', async () => {
        const page = renderPage();

        await page.submit();

        expect(await screen.findByText('An image file is required')).toBeInTheDocument();
        expect(screen.getByText('A target width is required')).toBeInTheDocument();
        expect(screen.getByText('A target height is required')).toBeInTheDocument();
        expect(FakeWorker.instances).toEqual([]);
    });

    it('labels the inputs and links their errors', async () => {
        const page = renderPage();

        await page.submit();

        await screen.findByText('A target width is required');
        const error = screen.getByText('A target width is required');
        expect(page.width()).toHaveAttribute('aria-invalid', 'true');
        expect(page.width().getAttribute('aria-describedby')).toContain(error.id);
        expect(screen.getByLabelText('Image File').getAttribute('aria-describedby'))
            .toContain(screen.getByText('An image file is required').id);
    });

    it('rejects non-positive dimensions', async () => {
        const page = renderPage();

        await page.fill('small.png', '0', '-5');
        await page.submit();

        expect(await screen.findByText('Target width must be positive')).toBeInTheDocument();
        expect(screen.getByText('Target height must be positive')).toBeInTheDocument();
    });

    it('rejects dimensions larger than the input image', async () => {
        const page = renderPage();

        await page.fill('small.png', '101', '81');
        await page.submit();

        expect(await screen.findByText("Target width must be <= the input image's width, 100")).toBeInTheDocument();
        expect(screen.getByText("Target height must be <= the input image's height, 80")).toBeInTheDocument();
        expect(FakeWorker.instances).toEqual([]);
    });

    it('shows the chosen image with its size and prefills the targets', async () => {
        const page = renderPage();

        await page.choose('small.png');

        expect(await screen.findByAltText('Input image, 100 × 80 px')).toHaveAttribute('src', 'blob:small.png');
        expect(screen.getByText(/Chosen image: 100 × 80 px/)).toBeInTheDocument();
        expect(screen.getByText(/Carving runs in your browser/)).toBeInTheDocument();
        expect(page.width()).toHaveValue(100);
        expect(page.height()).toHaveValue(80);
    });

    it('decodes each chosen file once', async () => {
        const page = renderPage();

        await page.carve('small.png', '50', '40');

        expect(decode.decodes).toEqual(['small.png']);
    });

    it('rejects files that are not images', async () => {
        const page = renderPage();

        await page.choose('notes.png');

        expect(await screen.findByText("Couldn't read this file as an image. Choose a PNG or JPEG.")).toBeInTheDocument();
        expect(revoked).toContain('blob:notes.png');
    });

    it('carves small images with the original Java in a module worker', async () => {
        const page = renderPage();

        const worker = await page.carve('small.png', '50', '40');

        expect(String(worker.url)).toContain('/engine/carve.worker.ts');
        expect(worker.options).toEqual({ type: 'module' });
        const [message] = worker.sent;
        expect(message).toMatchObject({
            type: 'start', engine: 'java', variant: undefined,
            width: 100, height: 80, targetWidth: 50, targetHeight: 40,
        });
        expect(message.rgb).toHaveLength(8000);
    });

    it('shows progress, then the result on a canvas with the engine that ran and a download link', async () => {
        const page = renderPage();
        const worker = await page.carve('small.png', '50', '40');

        expect(screen.getByRole('status')).toHaveTextContent('Carving with the original Java');
        expect(screen.getByRole('button', { name: 'Carve' })).toBeDisabled();
        expect(page.width()).toBeDisabled();

        worker.emit({ type: 'progress', done: 0, total: 90 });
        worker.emit({ type: 'progress', done: 45, total: 90 });
        expect(screen.getByRole('status')).toHaveTextContent('Carving with the original Java: 45 of 90 seams');
        expect(screen.getByLabelText('Carving progress')).toHaveAttribute('aria-valuenow', '50');

        worker.finish(50, 40, 'java-wasm');

        const canvas = await screen.findByRole('img', { name: 'Carved image, 50 × 40 px' });
        expect(canvas.tagName).toBe('CANVAS');
        // The visualisation draws the input on a canvas of its own
        const carved = decode.drawn.filter(d => d.label?.startsWith('Carved image'));
        expect(carved).toHaveLength(1);
        expect(carved[0]).toMatchObject({ width: 50, height: 40 });
        expect(screen.getByText(JAVA_WASM_LABEL)).toBeInTheDocument();
        const download = await screen.findByRole('link', { name: 'Download PNG' });
        expect(download).toHaveAttribute('href', 'blob:png-1');
        expect(download).toHaveAttribute('download', 'small-50x40.png');
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
        expect(screen.queryByLabelText('Carving progress')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Carve' })).toBeEnabled();
        expect(worker.terminated).toBe(false);
    });

    it('names the JavaScript fallback when the Java ran as JavaScript', async () => {
        const page = renderPage();
        const worker = await page.carve('small.png', '50', '40');

        worker.finish(50, 40, 'java-js', 25_000);

        expect(await screen.findByText('Carved by the original Java (JavaScript fallback via TeaVM), in 25 s.')).toBeInTheDocument();
    });

    it('reuses the worker for the next carve', async () => {
        const page = renderPage();
        const worker = await page.carve('small.png', '50', '40');
        worker.finish(50, 40, 'java-wasm');
        await screen.findByRole('img', { name: 'Carved image, 50 × 40 px' });

        await page.submit();

        await waitFor(() => expect(worker.sent).toHaveLength(2));
        expect(FakeWorker.instances).toHaveLength(1);
        // The previous result's download is revoked as it goes
        await waitFor(() => expect(revoked).toContain('blob:png-1'));
    });

    it('cancels by terminating the worker, and carves again on a fresh one', async () => {
        const page = renderPage();
        const worker = await page.carve('small.png', '50', '40');
        worker.emit({ type: 'progress', done: 3, total: 90 });

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(worker.terminated).toBe(true);
        expect(screen.getByRole('status')).toHaveTextContent('Carve cancelled.');
        expect(screen.getByRole('button', { name: 'Carve' })).toBeEnabled();
        expect(page.width()).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        // A message the old worker had already sent changes nothing
        worker.finish(50, 40, 'java-wasm');
        expect(screen.queryByRole('img', { name: /Carved image/ })).not.toBeInTheDocument();

        await page.submit();
        await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
        expect(lastWorker().sent).toHaveLength(1);
    });

    it('shows a failed carve and discards its worker', async () => {
        const page = renderPage();
        const worker = await page.carve('small.png', '50', '40');

        worker.emit({ type: 'error', reason: 'failed', engine: 'java', message: 'boom' });

        expect(await screen.findByText("Couldn't carve the image: boom")).toBeInTheDocument();
        expect(worker.terminated).toBe(true);
        expect(screen.getByRole('button', { name: 'Carve' })).toBeEnabled();
    });

    it('shows a worker that dies', async () => {
        const page = renderPage();
        const worker = await page.carve('small.png', '50', '40');

        act(() => worker.onerror?.({ message: 'Script error', preventDefault() {} } as ErrorEvent));

        expect(await screen.findByText("Couldn't carve the image: Script error")).toBeInTheDocument();
        expect(worker.terminated).toBe(true);
        // Not memory: no rerun
        expect(FakeWorker.instances).toHaveLength(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('reruns on the Rust engine when the Java runs out of memory', async () => {
        const page = renderPage();
        const java = await page.carve('small.png', '50', '40');

        java.emit({ type: 'error', reason: 'out-of-memory', engine: 'java', message: 'unreachable' });

        expect(java.terminated).toBe(true);
        // A trap may be a bug rather than memory: its message is kept for devtools
        expect(warn).toHaveBeenCalledWith("The seam carver's java engine ran out of memory: unreachable");
        await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
        const rust = lastWorker();
        expect(rust.sent[0]).toMatchObject({ engine: 'rust', variant: undefined, width: 100, targetWidth: 50 });
        expect(screen.getByRole('status')).toHaveTextContent('Carving with the Rust engine');

        rust.finish(50, 40, 'rust');

        expect(await screen.findByText(RUST_LABEL)).toBeInTheDocument();
        expect(screen.getByText('The original Java ran out of memory, so the Rust engine carved the image instead.'))
            .toBeInTheDocument();
    });

    it('says so when the Rust engine runs out of memory', async () => {
        const page = renderPage();
        await page.fill('small.png', '50', '40');
        await userEvent.click(page.fastSwitch());
        await page.submit();
        await waitFor(() => expect(lastWorker()?.sent).toHaveLength(1));

        lastWorker().emit({ type: 'error', reason: 'out-of-memory', engine: 'rust', message: 'unreachable' });

        expect(await screen.findByText(OUT_OF_MEMORY_MESSAGE)).toBeInTheDocument();
        expect(FakeWorker.instances).toHaveLength(1);
        expect(warn).toHaveBeenCalledWith("The seam carver's rust engine ran out of memory: unreachable");
    });

    it('reruns on the Rust engine when the Java worker dies of running out of memory', async () => {
        const page = renderPage();
        const java = await page.carve('small.png', '50', '40');

        // As SpiderMonkey ends a worker's script whose heap is exhausted
        act(() => java.onerror?.({ message: 'out of memory', preventDefault() {} } as ErrorEvent));

        expect(java.terminated).toBe(true);
        await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
        expect(lastWorker().sent[0]).toMatchObject({ engine: 'rust', variant: undefined });
        lastWorker().finish(50, 40, 'rust');
        expect(await screen.findByText('The original Java ran out of memory, so the Rust engine carved the image instead.'))
            .toBeInTheDocument();
    });

    it('says so when the Rust worker dies of running out of memory', async () => {
        const page = renderPage();
        await page.fill('small.png', '50', '40');
        await userEvent.click(page.fastSwitch());
        await page.submit();
        await waitFor(() => expect(lastWorker()?.sent).toHaveLength(1));

        act(() => lastWorker().onerror?.({ message: 'Uncaught InternalError: out of memory', preventDefault() {} } as ErrorEvent));

        expect(await screen.findByText(OUT_OF_MEMORY_MESSAGE)).toBeInTheDocument();
        expect(FakeWorker.instances).toHaveLength(1);
    });

    it('carves on the Rust engine when the visitor asks for the fast one', async () => {
        const page = renderPage();
        await page.fill('small.png', '50', '40');
        expect(page.fastSwitch()).not.toBeChecked();
        expect(page.fastSwitch()).toBeEnabled();

        await userEvent.click(page.fastSwitch());
        await page.submit();

        await waitFor(() => expect(lastWorker()?.sent[0]).toMatchObject({ engine: 'rust' }));
    });

    it('gives the Java an image of exactly its pixel limit', async () => {
        const page = renderPage();

        await page.choose('java-max.png');
        await screen.findByText(/Chosen image: 96048 × 1 px/);
        expect(page.fastSwitch()).toBeEnabled();
        expect(page.fastSwitch()).not.toBeChecked();

        // Removing nothing, so no slow warning
        const worker = await page.carve('java-max.png', '96048', '1');
        expect(worker.sent[0]).toMatchObject({ engine: 'java' });
        // An image the Java takes leaves the worker small enough to keep
        worker.finish(96048, 1, 'java-wasm');
        await screen.findByRole('img', { name: 'Carved image, 96048 × 1 px' });
        expect(worker.terminated).toBe(false);
    });

    it('carves an image over the limit on the Rust engine and says why the Java is off', async () => {
        const page = renderPage();

        const worker = await page.carve('java-over.png', '96049', '1');

        expect(worker.sent[0]).toMatchObject({ engine: 'rust' });
        // WebAssembly memory never shrinks: a worker that carved a large image isn't kept
        worker.finish(96049, 1, 'rust');
        await screen.findByRole('img', { name: 'Carved image, 96049 × 1 px' });
        expect(worker.terminated).toBe(true);
        expect(page.fastSwitch()).toBeChecked();
        expect(page.fastSwitch()).toBeDisabled();
        expect(page.fastSwitch()).toHaveAccessibleDescription(
            'The original Java needs about 3.4 KB per pixel, so it carves images up to 96,048 pixels; this one uses the fast engine.');
    });

    it('warns before a slow carve and starts it only when asked', async () => {
        const page = renderPage();
        await page.fill('huge.png', '1000', '1500');

        await page.submit();

        // 2000 x 1500 to half its width: 2.25 billion pixel-seams at 5 ns
        expect(await screen.findByText('This will take about 11 s.')).toBeInTheDocument();
        expect(FakeWorker.instances).toEqual([]);

        await userEvent.click(screen.getByRole('button', { name: 'Carve anyway' }));

        await waitFor(() => expect(lastWorker()?.sent[0]).toMatchObject({ engine: 'rust', targetWidth: 1000 }));
        expect(screen.queryByText(/This will take about/)).not.toBeInTheDocument();
    });

    it('drops a slow warning when the targets change', async () => {
        const page = renderPage();
        await page.fill('huge.png', '1000', '1500');
        await page.submit();
        await screen.findByText(/This will take about/);

        await userEvent.clear(page.width());
        await userEvent.type(page.width(), '1990');

        expect(screen.queryByText(/This will take about/)).not.toBeInTheDocument();
        await page.submit();
        await waitFor(() => expect(lastWorker()?.sent[0]).toMatchObject({ targetWidth: 1990 }));
    });

    it.each(['java-wasm', 'java-js', 'rust'] as const)('forces the %s variant with ?engine=', async variant => {
        window.history.replaceState(null, '', `/projects/seamCarver?engine=${variant}`);
        const page = renderPage();

        const worker = await page.carve('small.png', '50', '40');

        expect(worker.sent[0]).toMatchObject({ engine: variant === 'rust' ? 'rust' : 'java', variant });
    });

    it('ignores an unknown ?engine=', async () => {
        window.history.replaceState(null, '', '/projects/seamCarver?engine=cobol');
        const page = renderPage();

        const worker = await page.carve('small.png', '50', '40');

        expect(worker.sent[0]).toMatchObject({ engine: 'java', variant: undefined });
    });

    it('revokes object URLs it replaces and those it holds on unmount, and stops the worker', async () => {
        const page = renderPage();

        await page.choose('other.png');
        await screen.findByAltText('Input image, 60 × 40 px');
        const worker = await page.carve('small.png', '50', '40');
        expect(revoked).toEqual(['blob:other.png']);
        worker.finish(50, 40, 'java-wasm');
        await screen.findByRole('link', { name: 'Download PNG' });

        page.unmount();
        expect(revoked.sort()).toEqual(['blob:other.png', 'blob:png-1', 'blob:small.png']);
        expect(worker.terminated).toBe(true);
    });

    it('ignores a decode that finishes after another file was chosen', async () => {
        const page = renderPage();

        decode.held['small.png'] = () => {};
        await page.choose('small.png');
        await page.choose('other.png');
        await screen.findByAltText('Input image, 60 × 40 px');
        expect(page.width()).toHaveValue(60);

        decode.held['small.png']();
        await waitFor(() => expect(revoked).toEqual(['blob:small.png']));
        expect(screen.getByAltText('Input image, 60 × 40 px')).toBeInTheDocument();
        expect(screen.queryByAltText(/100 × 80/)).not.toBeInTheDocument();
        expect(page.width()).toHaveValue(60);
        expect(page.height()).toHaveValue(40);
    });

    it('validates a newly chosen file against its own decode', async () => {
        const page = renderPage();

        await page.choose('notes.png');
        await screen.findByText(/Couldn't read this file/);

        decode.held['small.png'] = () => {};
        await page.choose('small.png');
        // While small.png decodes, RHF's revalidation must wait for it rather than call it unreadable
        await new Promise(resolve => setTimeout(resolve, 20));
        decode.held['small.png']();
        await screen.findByAltText('Input image, 100 × 80 px');

        await waitFor(() => expect(screen.queryByText(/Couldn't read this file/)).not.toBeInTheDocument());
    });

    it('clears stale target errors when a new image prefills the targets', async () => {
        const page = renderPage();

        await page.fill('other.png', '61', '41');
        await page.submit();
        await screen.findByText("Target width must be <= the input image's width, 60");

        await page.choose('small.png');
        await waitFor(() => expect(page.width()).toHaveValue(100));

        expect(screen.queryByText(/Target width must be/)).not.toBeInTheDocument();
        expect(page.width()).toHaveAttribute('aria-invalid', 'false');
    });

    it('shows the visualisation of the chosen image, following the targets as they are typed', async () => {
        const page = renderPage();
        const viewStatus = () => document.getElementById('seamCarverViewStatus')?.textContent;
        expect(screen.queryByRole('heading', { name: 'Step through the carve' })).not.toBeInTheDocument();

        await page.choose('small.png');
        // The targets start at the image's size: nothing to step through
        await waitFor(() => expect(viewStatus()).toBe('100 × 80 px, 0 seams removed. At the target size.'));
        expect(screen.getByRole('img', { name: 'Image being carved, 100 × 80 px' })).toBeInTheDocument();

        await userEvent.clear(page.width());
        await userEvent.type(page.width(), '90');
        expect(viewStatus()).toBe('100 × 80 px, 0 seams removed. Next: a vertical seam.');
        await userEvent.clear(page.width());
        await userEvent.type(page.width(), '101');
        expect(viewStatus()).toBe('Choose a target size above to step through its seams.');
        // Nothing has asked the view for a frame, so it has no worker
        expect(FakeWorker.instances).toEqual([]);
    });
});

describe('formatDuration', () => {
    it('gives short times in tenths, then seconds, then minutes', () => {
        expect(formatDuration(0.001)).toBe('0.1 s');
        expect(formatDuration(1.234)).toBe('1.2 s');
        expect(formatDuration(17.4)).toBe('17 s');
        expect(formatDuration(200)).toBe('3 min');
    });
});
