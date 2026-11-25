import SeamCarving.EnergyOracle;
import SeamCarving.FromFileImage;
import SeamCarving.SeamCarver;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

/**
 * The seam carver's golden fixtures: each case's input image, built in memory, and what the
 * untouched SeamCarving Java makes of it. Every other engine (TeaVM, Rust) must match the goldens
 * pixel for pixel.
 *
 * <p>{@code main(dir)} writes {@code <case>.in} and {@code <case>.out} for every case, and
 * {@code <case>.energy} for the {@link #ENERGY_CASES}, into {@code dir}, in the format of
 * {@link #encode}; see testdata/seamcarver/README.md.
 */
public final class GoldenWriter {
    private GoldenWriter() {
    }

    /** How a case's input is drawn. */
    public enum Pattern {
        /** A smooth RGB gradient plus seeded noise, so seams are distinct but not trivial. */
        NOISY_GRADIENT,
        /** Two flat colours in 5x5 blocks: most energies tie exactly, exercising the tie-breaks. */
        FLAT_BLOCKS,
        /** The end-to-end tests' gradient (gradientPng in e2e/tests/png.ts), pixel for pixel. */
        E2E_GRADIENT,
    }

    /** One golden: an input of width x height carved to targetWidth x targetHeight. */
    public record Case(String name, Pattern pattern, int width, int height, int targetWidth,
                       int targetHeight, int seed) {
        @Override
        public String toString() {
            return String.format("%s (%dx%d -> %dx%d)", name, width, height, targetWidth, targetHeight);
        }
    }

    /** Every golden; the output size of each is its target, so a reader needs no other list. */
    public static final List<Case> CASES = List.of(
            new Case("small-vertical", Pattern.NOISY_GRADIENT, 12, 10, 9, 10, 1),
            new Case("small-horizontal", Pattern.NOISY_GRADIENT, 12, 10, 12, 7, 1),
            new Case("small-both", Pattern.NOISY_GRADIENT, 12, 10, 8, 6, 1),
            new Case("small-noop", Pattern.NOISY_GRADIENT, 12, 10, 12, 10, 1),
            new Case("width-one", Pattern.NOISY_GRADIENT, 33, 17, 1, 17, 2),
            new Case("height-one", Pattern.NOISY_GRADIENT, 17, 33, 17, 1, 5),
            new Case("row-one", Pattern.NOISY_GRADIENT, 40, 1, 25, 1, 6),
            new Case("column-one", Pattern.NOISY_GRADIENT, 1, 30, 1, 20, 7),
            new Case("flat-ties", Pattern.FLAT_BLOCKS, 20, 20, 15, 15, 0),
            new Case("medium", Pattern.NOISY_GRADIENT, 64, 48, 48, 36, 3),
            new Case("large", Pattern.NOISY_GRADIENT, 120, 90, 90, 70, 4),
            new Case("e2e-gradient", Pattern.E2E_GRADIENT, 60, 40, 45, 32, 0));

    /**
     * The cases whose input's energy map ({@code GraphImage.toEnergyImage}) is a golden too, for
     * the page's energy view: one is enough, since the Rust engine's map is checked natively too.
     */
    public static final Set<String> ENERGY_CASES = Set.of("e2e-gradient");

    /** The case's input, as the server's decoder hands it to the carver: opaque 8-bit RGB. */
    public static BufferedImage input(Case c) {
        BufferedImage image = new BufferedImage(c.width(), c.height(), BufferedImage.TYPE_INT_RGB);
        // A 31-bit LCG (glibc's constants): only the generator needs it, readers use the files
        long state = c.seed();
        for (int y = 0; y < c.height(); y++) {
            for (int x = 0; x < c.width(); x++) {
                int r, g, b;
                switch (c.pattern()) {
                    case NOISY_GRADIENT -> {
                        state = (state * 1103515245L + 12345L) & 0x7fffffffL;
                        int noise = (int) (state >> 16) % 64 - 32;
                        r = clamp(x * 255 / c.width() + noise);
                        g = clamp(y * 255 / c.height() - noise);
                        b = clamp((x + y) * 255 / (c.width() + c.height()) + noise / 2);
                    }
                    case FLAT_BLOCKS -> {
                        boolean light = ((x / 5) + (y / 5)) % 2 == 0;
                        r = g = b = light ? 200 : 60;
                    }
                    case E2E_GRADIENT -> {
                        r = x * 255 / c.width();
                        g = y * 255 / c.height();
                        b = ((x + y) * 7) % 256;
                    }
                    default -> throw new IllegalStateException(c.pattern().toString());
                }
                image.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        return image;
    }

    /** What the untouched SeamCarving Java makes of the case's input. */
    public static BufferedImage carve(Case c) {
        return new SeamCarver()
                .carve(new FromFileImage(input(c)), c.targetWidth(), c.targetHeight())
                .getImage();
    }

    /** The untouched Java's energy map of the case's input, before any seam is removed. */
    public static BufferedImage energy(Case c) {
        return EnergyOracle.energyImage(new FromFileImage(input(c)));
    }

    /**
     * The golden file format: little-endian int32 width, int32 height, then width * height
     * little-endian int32 pixels 0x00RRGGBB, rows top to bottom, each left to right.
     */
    public static byte[] encode(BufferedImage image) {
        int w = image.getWidth(), h = image.getHeight();
        ByteBuffer bytes = ByteBuffer.allocate(8 + 4 * w * h).order(ByteOrder.LITTLE_ENDIAN);
        bytes.putInt(w).putInt(h);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                bytes.putInt(image.getRGB(x, y) & 0xffffff);
            }
        }
        return bytes.array();
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 1) {
            throw new IllegalArgumentException("usage: GoldenWriter <testdata/seamcarver dir>");
        }
        Path dir = Path.of(args[0]);
        Files.createDirectories(dir);
        for (Case c : CASES) {
            Files.write(dir.resolve(c.name() + ".in"), encode(input(c)));
            BufferedImage out = carve(c);
            Files.write(dir.resolve(c.name() + ".out"), encode(out));
            System.out.printf("%s: %dx%d -> %dx%d%n", c.name(), c.width(), c.height(),
                    out.getWidth(), out.getHeight());
            if (ENERGY_CASES.contains(c.name())) {
                Files.write(dir.resolve(c.name() + ".energy"), encode(energy(c)));
                System.out.printf("%s: energy map%n", c.name());
            }
        }
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(255, v));
    }
}
