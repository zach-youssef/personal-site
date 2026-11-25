package SeamCarving;

import shim.awt.Color;

/**
 * The browser build's replacement for the SeamCarving {@code ComputedPixelImage}: the image the
 * carver draws its result onto, an int array instead of a {@code BufferedImage}. Same constructor
 * and {@code setPixel}, which is all the carving classes call.
 */
public class ComputedPixelImage implements WorldImage {
    private final int width;
    private final int height;
    private final int[] pixels;

    public ComputedPixelImage(int width, int height) {
        this.width = width;
        this.height = height;
        pixels = new int[width * height];
    }

    public void setPixel(int x, int y, Color color) {
        pixels[y * width + x] = color.getRGB();
    }

    @Override
    public int[] getPixels() {
        return pixels;
    }

    @Override
    public int getWidth() {
        return width;
    }

    @Override
    public int getHeight() {
        return height;
    }
}
