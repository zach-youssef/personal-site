import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeamCarverPage from './SeamCarverPage';

// jsdom doesn't decode images, so fake Image loads using dimensions keyed by file name
const imageSizes: Record<string, { width: number, height: number }> = {
    'small.png': { width: 100, height: 80 },
    'huge.png': { width: 400, height: 300 },
};

class FakeImage {
    width = 0;
    height = 0;
    onload: (() => void) | null = null;
    private source = '';

    get src() {
        return this.source;
    }

    set src(url: string) {
        this.source = url;
        Object.assign(this, imageSizes[url.replace('blob:', '')]);
        setTimeout(() => this.onload?.());
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

describe('SeamCarverPage', () => {
    beforeEach(() => {
        vi.stubGlobal('Image', FakeImage);
        URL.createObjectURL = vi.fn((obj: Blob | MediaSource) => obj instanceof File ? `blob:${obj.name}` : 'blob:carved');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function renderPage() {
        const view = render(<SeamCarverPage />);
        const input = (name: string) => view.container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
        return {
            ...view,
            async fill(fileName: string, width: string, height: string) {
                await userEvent.upload(screen.getByLabelText('Image File'), new File(['png'], fileName, { type: 'image/png' }));
                await userEvent.type(input('width'), width);
                await userEvent.type(input('height'), height);
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

    it('rejects images over the memory limit', async () => {
        const page = renderPage();

        await page.fill('huge.png', '10', '10');
        await page.submit();

        expect(await screen.findByText('Image is too large for current memory limitations. Please try another.')).toBeInTheDocument();
    });

    it('uploads the image and shows the carved result', async () => {
        const response = deferred<Response>();
        const fetchMock = vi.fn(() => response.promise);
        vi.stubGlobal('fetch', fetchMock);
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();

        expect(await screen.findByText('Carving image (this might take a while)')).toBeInTheDocument();
        expect(screen.getByAltText('Input file')).toHaveAttribute('src', 'blob:small.png');

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://zyoussef.com/seamCarver/upload');
        expect(init.method).toBe('POST');
        const form = init.body as FormData;
        expect(form.get('width')).toBe('50');
        expect(form.get('height')).toBe('40');
        expect((form.get('file') as File).name).toBe('small.png');

        response.resolve({ ok: true, blob: async () => new Blob(['carved']) } as Response);

        expect(await screen.findByAltText('Seam Carving Result')).toHaveAttribute('src', 'blob:carved');
        expect(screen.queryByText('Carving image (this might take a while)')).not.toBeInTheDocument();
    });

    it('shows errors returned by the server', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false,
            text: async () => 'Ran out of memory, try a smaller image',
        })));
        const page = renderPage();

        await page.fill('small.png', '50', '40');
        await page.submit();

        expect(await screen.findByText('Ran out of memory, try a smaller image')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('Carving image (this might take a while)')).not.toBeInTheDocument());
        expect(screen.queryByAltText('Seam Carving Result')).not.toBeInTheDocument();
    });
});
