package SeamCarving;

import shim.awt.Color;

/**
 * The browser build's replacement for the SeamCarving {@code FromFileImage}: the carver's input,
 * which the original decodes from a PNG file with ImageIO. Here it is the pixels the page decoded,
 * {@code 0xRRGGBB} ints (the top byte is ignored), rows top to bottom. {@link #getColorAt} takes
 * the colour apart exactly as the original does from {@code BufferedImage.getRGB}.
 */
public class FromFileImage {
    private final int[] pixels;
    private final int width;
    private final int height;

    public FromFileImage(int[] rgb, int width, int height) {
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("an image needs a width and a height, not "
                    + width + "x" + height);
        }
        if (rgb.length != (long) width * height) {
            throw new IllegalArgumentException("a " + width + "x" + height + " image needs "
                    + ((long) width * height) + " pixels, not " + rgb.length);
        }
        pixels = rgb;
        this.width = width;
        this.height = height;
    }

    /** The original reads a PNG file; the carving classes keep calling it, but the page never does. */
    public FromFileImage(String filename) {
        throw new IllegalStateException("the browser has no files to read: " + filename);
    }

    public int getHeight() {
        return height;
    }

    public int getWidth() {
        return width;
    }

    public Color getColorAt(int col, int row) {
        int rgb = pixels[row * width + col];
        int r = (rgb & 0xff0000) >> 16;
        int g = (rgb & 0x00ff00) >> 8;
        int b = (rgb & 0x0000ff);
        return new Color(r, g, b);
    }
}
