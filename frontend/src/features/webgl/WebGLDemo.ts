import { View, CameraMode } from './scenegraph/View';
import { Controller, SceneAssets } from './scenegraph/Controller';

export { CameraMode };

// The frame rate is averaged over this many frames
const FRAME_RATE_FRAMES = 100;

/**
 * Renders the scene graph demo into a canvas, animating it every frame until disposed.
 * The canvas's drawing buffer follows its displayed size, so size the canvas with CSS;
 * keep it square, as the camera assumes a square view.
 */
export class WebGLDemo {
    private readonly canvas: HTMLCanvasElement;
    private readonly gl: WebGLRenderingContext;
    private readonly view: View;
    private readonly controller: Controller;
    private readonly onFrameRate: (framesPerSecond: number) => void;
    private animationFrame: number | null = null;
    private framesCounted = 0;
    private countStart = -1;

    /**
     * Resolves once the scene has downloaded and is being drawn, or rejects if it couldn't load
     */
    public readonly loaded: Promise<void>;

    /**
     * Starts the demo, or returns null if the browser can't create a WebGL context
     * @param onFrameRate called every so often with the measured frames per second
     */
    public static create(canvas: HTMLCanvasElement, assets: SceneAssets,
                         onFrameRate: (framesPerSecond: number) => void): WebGLDemo | null {
        const gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true, stencil: false });
        return gl ? new WebGLDemo(canvas, gl, assets, onFrameRate) : null;
    }

    private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, assets: SceneAssets,
                        onFrameRate: (framesPerSecond: number) => void) {
        this.canvas = canvas;
        this.gl = gl;
        this.onFrameRate = onFrameRate;
        this.view = new View(gl);
        this.controller = new Controller(this.view);
        this.loaded = this.controller.go(assets);
        this.animationFrame = requestAnimationFrame(this.tick);
    }

    public setCameraMode(mode: CameraMode): void {
        this.view.setCameraMode(mode);
    }

    public setDrawPath(shouldDrawPath: boolean): void {
        this.view.setDrawPath(shouldDrawPath);
    }

    /**
     * Stops the animation and frees the demo's WebGL resources, including the context itself,
     * as browsers only allow a few at once
     */
    public dispose(): void {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.view.dispose();
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }

    private tick = (now: number): void => {
        this.measureFrameRate(now);
        this.fitDrawingBufferToCanvas();
        this.view.animate();
        this.view.draw();
        this.animationFrame = requestAnimationFrame(this.tick);
    };

    private measureFrameRate(now: number): void {
        if (this.countStart < 0) {
            this.countStart = now;
        }
        this.framesCounted++;
        if (this.framesCounted >= FRAME_RATE_FRAMES) {
            this.onFrameRate(1000 * this.framesCounted / (now - this.countStart));
            this.countStart = now;
            this.framesCounted = 0;
        }
    }

    // Matches the drawing buffer to the canvas's displayed size, in device pixels, so it stays sharp
    private fitDrawingBufferToCanvas(): void {
        const scale = window.devicePixelRatio || 1;
        const width = Math.round(this.canvas.clientWidth * scale);
        const height = Math.round(this.canvas.clientHeight * scale);
        // A canvas that isn't laid out, e.g. in a hidden tab, keeps its last size
        if (width > 0 && height > 0 && (this.canvas.width !== width || this.canvas.height !== height)) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }
}
