package shim.awt;

/**
 * The stand-in for {@code java.awt.Color} in the browser build: TeaVM's class library has no AWT.
 * The build copies the SeamCarving Java with its one {@code import java.awt.*;} ({@code Pixel.java})
 * pointed here, so this has exactly what that code uses: the three constants, the (r, g, b)
 * constructor and the getters. {@link #getRGB} packs as AWT does, alpha 0xff in the top byte.
 */
public class Color {
    public static final Color red = new Color(255, 0, 0);
    public static final Color white = new Color(255, 255, 255);
    public static final Color magenta = new Color(255, 0, 255);

    private final int rgb;

    public Color(int r, int g, int b) {
        rgb = 0xff000000 | (r << 16) | (g << 8) | b;
    }

    public int getRed() {
        return (rgb >> 16) & 0xff;
    }

    public int getGreen() {
        return (rgb >> 8) & 0xff;
    }

    public int getBlue() {
        return rgb & 0xff;
    }

    public int getRGB() {
        return rgb;
    }
}
