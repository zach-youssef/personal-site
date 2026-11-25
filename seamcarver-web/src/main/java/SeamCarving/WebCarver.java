package SeamCarving;

import org.teavm.jso.JSExport;

/**
 * What the browser calls: the SeamCarving Java, one seam at a time, so a worker can report
 * progress between seams and be stopped. It holds one {@link GraphImage} and calls the same
 * package-private methods in the same order as {@code SeamCarver.carve} (every vertical seam, then
 * every horizontal one), which the goldens prove gives the same pixels. The seam carver's Rust
 * engine exports the same stepwise shape, so one worker loop drives both.
 *
 * <p>TeaVM exports the static methods below to JavaScript (as the module's named exports in the
 * JS build, and as the instance's {@code exports} in the WebAssembly build). An image too large for
 * the heap fails inside {@link #begin} or a step with an out-of-memory error, which reaches the
 * caller as a JavaScript exception or a WebAssembly trap; the worker is then discarded.
 */
public final class WebCarver {
    private static GraphImage image;

    private WebCarver() {
    }

    /**
     * Starts carving an image of {@code width} x {@code height} {@code 0xRRGGBB} pixels (the top
     * byte ignored), rows top to bottom, each left to right, replacing any image begun before.
     */
    @JSExport
    public static void begin(int[] rgb, int width, int height) {
        image = null;
        image = new GraphImage(new FromFileImage(rgb, width, height));
    }

    /** Removes the next vertical seam; the image must be more than one pixel wide. */
    @JSExport
    public static void stepVertical() {
        if (width() <= 1) {
            throw new IllegalStateException("the image is one pixel wide");
        }
        image.removeVerticalSeam();
    }

    /** Removes the next horizontal seam; the image must be more than one pixel high. */
    @JSExport
    public static void stepHorizontal() {
        if (height() <= 1) {
            throw new IllegalStateException("the image is one pixel high");
        }
        image.removeHorizontalSeam();
    }

    /** The image's current width. */
    @JSExport
    public static int width() {
        return current().width - image.verticalSeamsRemoved;
    }

    /** The image's current height. */
    @JSExport
    public static int height() {
        return current().height - image.horizontalSeamsRemoved;
    }

    /**
     * The carved image: {@link #width()} x {@link #height()} {@code 0x00RRGGBB} pixels, rows top to
     * bottom, each left to right (the goldens' format).
     */
    @JSExport
    public static int[] result() {
        int[] pixels = current().toImage().getPixels();
        for (int i = 0; i < pixels.length; i++) {
            pixels[i] &= 0xffffff;
        }
        return pixels;
    }

    /** Drops the image, so its memory can be collected before the next {@link #begin}. */
    @JSExport
    public static void end() {
        image = null;
    }

    private static GraphImage current() {
        if (image == null) {
            throw new IllegalStateException("no image: call begin first");
        }
        return image;
    }

    /** TeaVM wants an entry point; the exports above are the interface. */
    public static void main(String[] args) {
    }
}
