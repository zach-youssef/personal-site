package SeamCarving;

import java.awt.image.BufferedImage;

/**
 * Reaches the untouched Java's package-private {@code GraphImage.toEnergyImage} for the goldens
 * (it lives in the oracle source set, in the submodule's package, so the submodule stays as it is).
 */
public final class EnergyOracle {
    private EnergyOracle() {
    }

    /** The image's energy map as the Java draws it: grey {@code (int) ((energy / maxEnergy) * 255.0)}. */
    public static BufferedImage energyImage(FromFileImage image) {
        return new GraphImage(image).toEnergyImage().getImage();
    }
}
