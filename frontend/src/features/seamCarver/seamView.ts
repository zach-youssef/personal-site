// The visualisation's state rules, kept apart from React so they can be tested on their own.
import { FrameMessage, SeamDirection, ViewLayer } from './engine/protocol';

export type Size = { width: number, height: number };

// The seam the carve removes next from an image of this size, as SeamCarver.carve orders them (every
// vertical seam, then every horizontal one), or undefined at the target
export function nextSeam(size: Size, target: Size | undefined): SeamDirection | undefined {
    if (!target) return undefined;
    if (size.width > target.width) return 'vertical';
    if (size.height > target.height) return 'horizontal';
    return undefined;
}

// The size after removing a seam in that direction
export const afterStep = (size: Size, direction: SeamDirection): Size =>
    direction === 'vertical' ? { width: size.width - 1, height: size.height } : { width: size.width, height: size.height - 1 };

// A target the image can be carved to, or undefined (empty, not a number, below 1 or above the image)
export function validTarget(image: Size, width: number, height: number): Size | undefined {
    const ok = (value: number, max: number) => Number.isInteger(value) && value >= 1 && value <= max;
    return ok(width, image.width) && ok(height, image.height) ? { width, height } : undefined;
}

// Whether the frame already shows what is wanted (a frame is undefined before the worker's first)
export function frameShows(frame: FrameMessage | undefined, layer: ViewLayer, seam: SeamDirection | undefined): boolean {
    if (!frame) return layer === 'image' && !seam;
    return frame.layer === layer && frame.seam?.direction === seam;
}

// The seam as an SVG path in pixel units: a unit square per pixel, one per row (vertical) or per
// column (horizontal), all in one element however long the seam
export function seamPath(seam: NonNullable<FrameMessage['seam']>): string {
    const squares: string[] = [];
    seam.positions.forEach((at, i) => {
        const [x, y] = seam.direction === 'vertical' ? [at, i] : [i, at];
        squares.push(`M${x} ${y}h1v1h-1z`);
    });
    return squares.join('');
}
