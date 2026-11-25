package SeamCarving;

/**
 * The browser build's replacement for the SeamCarving {@code WorldImage}, whose original wraps a
 * {@code BufferedImage} and saves PNG files: here an image is its pixels.
 */
public interface WorldImage {
    /** The pixels as {@code Color.getRGB()} ints, rows top to bottom, each left to right. */
    int[] getPixels();

    int getWidth();

    int getHeight();
}
