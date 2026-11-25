import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeamCarverPage, { MAX_UPLOAD_BYTES } from './SeamCarverPage';

// jsdom doesn't decode images, so fake Image loads using dimensions keyed by the object URL's name;
// an unknown name fails to decode
const imageSizes: Record<string, { width: number, height: number }> = {
    'small.png': { width: 100, height: 80 },
    'other.png': { width: 60, height: 40 },
    'huge.png': { width: 400, height: 300 },
    'carved': { width: 50, height: 40 },
};

let decodes: string[] = [];
// Loads of these names wait until released, to order decodes by hand
let held: Record<string, () => void> = {};

class FakeImage {
    width = 0;
    height = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private source = '';

    get src() {
        return this.source;
    }

    set src(url: string) {
        this.source = url;
        const name = url.replace('blob:', '');
        decodes.push(name);
        const size = imageSizes[name];
        if (size) Object.assign(this, size);
        const finish = () => size ? this.onload?.() : this.onerror?.();
        if (name in held) held[name] = () => setTimeout(finish);
        else setTimeout(finish);
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

// A response as fetch gives it, with only what the page reads
function fakeResponse(status: number, body: string, contentType: string) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? contentType : null },
        text: async () => body,
        blob: async () => new Blob([body], { type: contentType }),
    } as unknown as Response;
}

const SPINNER_TEXT = 'Carving image (this might take a while)';

describe('SeamCarverPage', () => {
    let revoked: string[];

    beforeEach(() => {
        decodes = [];
        held = {};
        revoked = [];
        vi.stubGlobal('Image', FakeImage);
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn((obj: Blob | MediaSource) => obj instanceof File ? `blob:${obj.name}` : 'blob:carved'),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn((url: string) => { revoked.push(url); }),
        });
    });

    afterEach(() => {
        // Unmount (which revokes URLs) while the URL stubs still exist
        cleanup();
        vi.unstubAllGlobals();
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
            async choose(fileName: string, file?: File) {
                await userEvent.upload(screen.getByLabelText('Image File'),
                    file ?? new File(['png'], fileName, { type: 'image/png' }));
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
        };
    }

    it('requires a file and target dimensions', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const page = renderPage();

        await page.submit();

        expect(await screen.findByText('An image file is required')).toBeInTheDocument();
        expect(screen.getByText('A target width is required')).toBeInTheDocument();
        expect(screen.getByText('A target height is required')).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
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
    });

    it('shows the chosen image with its size and prefills the targets', async () => {
        const page = renderPage();

        await page.choose('small.png');

        expect(await screen.findByAltText('Input image, 100 × 80 px')).toHaveAttribute('src', 'blob:small.png');
        expect(screen.getByText(/Chosen image: 100 × 80 px/)).toBeInTheDocument();
        expect(screen.getByText(/up to 1 MB and 96,048 pixels \(about 310 × 310 px\)/)).toBeInTheDocument();
        expect(page.width()).toHaveValue(100);
        expect(page.height()).toHaveValue(80);
    });

    it('decodes each chosen file once', async () => {
        const response = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn(() => response.promise));
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();
        await screen.findByText(SPINNER_TEXT);

        expect(decodes).toEqual(['small.png']);
    });

    it('rejects images over the pixel limit', async () => {
        const page = renderPage();

        await page.choose('huge.png');

        expect(await screen.findByText(
            'This image is 400 × 300 px, too large to carve: the most it takes is 96,048 pixels, about 310 × 310 px.',
        )).toBeInTheDocument();
    });

    it('rejects files over the upload limit without decoding or uploading them', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const page = renderPage();

        await page.choose('big.png', new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.png', { type: 'image/png' }));

        expect(await screen.findByText('Image file too large (max 1 MB)')).toBeInTheDocument();
        await userEvent.type(page.width(), '10');
        await userEvent.type(page.height(), '10');
        await page.submit();

        expect(screen.getByText('Image file too large (max 1 MB)')).toBeInTheDocument();
        expect(decodes).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects files that are not images', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const page = renderPage();

        await page.choose('notes.png');

        expect(await screen.findByText("Couldn't read this file as an image. Choose a PNG or JPEG.")).toBeInTheDocument();
        expect(revoked).toContain('blob:notes.png');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('uploads the image and shows the carved result with a download link', async () => {
        const response = deferred<Response>();
        const fetchMock = vi.fn(() => response.promise);
        vi.stubGlobal('fetch', fetchMock);
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();

        const status = await screen.findByRole('status');
        expect(status).toHaveTextContent(SPINNER_TEXT);
        expect(screen.getByRole('button', { name: 'Carve' })).toBeDisabled();

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('/seamCarver/upload');
        expect(init.method).toBe('POST');
        const form = init.body as FormData;
        expect(form.get('width')).toBe('50');
        expect(form.get('height')).toBe('40');
        expect((form.get('file') as File).name).toBe('small.png');

        response.resolve(fakeResponse(200, 'carved', 'image/png'));

        expect(await screen.findByAltText('Carved image, 50 × 40 px')).toHaveAttribute('src', 'blob:carved');
        const download = screen.getByRole('link', { name: 'Download PNG' });
        expect(download).toHaveAttribute('href', 'blob:carved');
        expect(download).toHaveAttribute('download', 'small-50x40.png');
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
        expect(screen.getByRole('button', { name: 'Carve' })).toBeEnabled();
    });

    it('keeps the status region mounted so changes to it are announced', async () => {
        const response = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn(() => response.promise));
        const page = renderPage();
        const before = screen.getByRole('status');
        expect(before).toBeEmptyDOMElement();

        await page.fill('small.png', '50', '40');
        await page.submit();

        await waitFor(() => expect(before).toHaveTextContent(SPINNER_TEXT));
        expect(screen.getByRole('status')).toBe(before);
    });

    it('shows plain-text errors returned by the server', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(413, 'Ran out of memory, try a smaller image', 'text/plain')));
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();

        expect(await screen.findByText('Ran out of memory, try a smaller image')).toBeInTheDocument();
        expect(screen.queryByText(SPINNER_TEXT)).not.toBeInTheDocument();
        expect(screen.queryByAltText(/Carved image/)).not.toBeInTheDocument();
    });

    it('replaces an HTML error page with a generic message', async () => {
        vi.stubGlobal('fetch', vi.fn(async () =>
            fakeResponse(502, '<html><body><h1>502 Bad Gateway</h1></body></html>', 'text/html; charset=utf-8')));
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();

        expect(await screen.findByText("The server couldn't carve the image (error 502). Try again later.")).toBeInTheDocument();
        expect(screen.queryByText(/Bad Gateway/)).not.toBeInTheDocument();
        expect(screen.queryByText(SPINNER_TEXT)).not.toBeInTheDocument();
    });

    it('replaces any non-plain-text error body with the generic message', async () => {
        vi.stubGlobal('fetch', vi.fn(async () =>
            fakeResponse(500, '{"error":"boom","trace":"at Foo.bar"}', 'application/json')));
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();

        expect(await screen.findByText("The server couldn't carve the image (error 500). Try again later.")).toBeInTheDocument();
        expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
    });

    it('stops the spinner and says so when the server is unreachable', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();

        expect(await screen.findByText("Couldn't reach the server, try again.")).toBeInTheDocument();
        expect(screen.queryByText(SPINNER_TEXT)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Carve' })).toBeEnabled();
    });

    it('revokes object URLs it replaces and those it holds on unmount', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, 'carved', 'image/png')));
        const page = renderPage();

        await page.choose('other.png');
        await screen.findByAltText('Input image, 60 × 40 px');
        await page.fill('small.png', '50', '40');
        expect(revoked).toEqual(['blob:other.png']);

        await page.submit();
        await screen.findByAltText('Carved image, 50 × 40 px');
        expect(revoked).toEqual(['blob:other.png']);

        page.unmount();
        expect(revoked.sort()).toEqual(['blob:carved', 'blob:other.png', 'blob:small.png']);
    });

    it('validates a newly chosen file against its own decode after a failed submit', async () => {
        vi.stubGlobal('fetch', vi.fn());
        const page = renderPage();

        await page.choose('big.png', new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.png', { type: 'image/png' }));
        await page.submit();
        await screen.findByText('Image file too large (max 1 MB)');

        held['small.png'] = () => {};
        await page.choose('small.png');
        // While small.png decodes, RHF's revalidation must wait for it rather than call it unreadable
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(screen.queryByText(/Couldn't read this file/)).not.toBeInTheDocument();
        held['small.png']();
        await screen.findByAltText('Input image, 100 × 80 px');

        await waitFor(() => expect(screen.queryByText('Image file too large (max 1 MB)')).not.toBeInTheDocument());
        expect(screen.queryByText(/Couldn't read this file/)).not.toBeInTheDocument();
    });

    it('ignores a decode that finishes after another file was chosen', async () => {
        const page = renderPage();

        held['small.png'] = () => {};
        await page.choose('small.png');
        await page.choose('other.png');
        await screen.findByAltText('Input image, 60 × 40 px');
        expect(page.width()).toHaveValue(60);

        held['small.png']();
        await waitFor(() => expect(revoked).toEqual(['blob:small.png']));
        expect(screen.getByAltText('Input image, 60 × 40 px')).toBeInTheDocument();
        expect(screen.queryByAltText(/100 × 80/)).not.toBeInTheDocument();
        expect(page.width()).toHaveValue(60);
        expect(page.height()).toHaveValue(40);
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
});
