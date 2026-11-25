import SeamCarving.SeamCarver;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.FieldSource;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * The untouched SeamCarving Java must reproduce the committed goldens exactly, pixel for pixel.
 * A failure means the Java (the submodule) or a fixture changed: regenerate with
 * {@code -Pgoldens.write=true} only if that change is intended.
 */
class GoldenTest {
    private static final Path DIR = Path.of(System.getProperty("goldens.dir"));

    static final List<GoldenWriter.Case> CASES = GoldenWriter.CASES;

    static final List<GoldenWriter.Case> ENERGY_CASES = CASES.stream()
            .filter(c -> GoldenWriter.ENERGY_CASES.contains(c.name()))
            .toList();

    @Test
    void everyEnergyCaseIsACase() {
        assertEquals(GoldenWriter.ENERGY_CASES.size(), ENERGY_CASES.size(), "ENERGY_CASES names a case");
    }

    @ParameterizedTest(name = "{0}")
    @FieldSource("CASES")
    void inputMatchesTheGolden(GoldenWriter.Case c) throws IOException {
        assertSameImage(c.name() + ".in", GoldenWriter.input(c));
    }

    @ParameterizedTest(name = "{0}")
    @FieldSource("CASES")
    void carveMatchesTheGolden(GoldenWriter.Case c) throws IOException {
        BufferedImage out = GoldenWriter.carve(c);
        assertEquals(c.targetWidth(), out.getWidth(), "width");
        assertEquals(c.targetHeight(), out.getHeight(), "height");
        assertSameImage(c.name() + ".out", out);
    }

    @ParameterizedTest(name = "{0}")
    @FieldSource("ENERGY_CASES")
    void energyMatchesTheGolden(GoldenWriter.Case c) throws IOException {
        assertSameImage(c.name() + ".energy", GoldenWriter.energy(c));
    }

    // The server's path: the input as a PNG file, decoded by ImageIO, carved by file name
    @ParameterizedTest(name = "{0}")
    @FieldSource("CASES")
    void carvingAPngFileMatchesTheGolden(GoldenWriter.Case c, @TempDir Path tmp) throws IOException {
        Path png = tmp.resolve(c.name() + ".png");
        if (!ImageIO.write(GoldenWriter.input(c), "png", png.toFile())) {
            fail("no PNG writer");
        }
        BufferedImage out = new SeamCarver()
                .carve(png.toString(), c.targetWidth(), c.targetHeight())
                .getImage();
        assertSameImage(c.name() + ".out", out);
    }

    @Test
    void theDirectoryHoldsExactlyTheCases() throws IOException {
        Set<String> expected = new TreeSet<>(Set.of("README.md"));
        for (GoldenWriter.Case c : CASES) {
            expected.add(c.name() + ".in");
            expected.add(c.name() + ".out");
        }
        for (GoldenWriter.Case c : ENERGY_CASES) {
            expected.add(c.name() + ".energy");
        }
        Set<String> actual;
        try (Stream<Path> files = Files.list(DIR)) {
            actual = files.map(p -> p.getFileName().toString())
                    .collect(Collectors.toCollection(TreeSet::new));
        }
        assertEquals(expected, actual);
    }

    // Compares by pixel rather than by byte, to name the first differing pixels
    private static void assertSameImage(String golden, BufferedImage actual) throws IOException {
        ByteBuffer bytes = ByteBuffer.wrap(Files.readAllBytes(DIR.resolve(golden)))
                .order(ByteOrder.LITTLE_ENDIAN);
        int w = bytes.getInt(), h = bytes.getInt();
        assertEquals(8 + 4L * w * h, bytes.capacity(), golden + ": file size for " + w + "x" + h);
        assertEquals(w + "x" + h, actual.getWidth() + "x" + actual.getHeight(), golden + ": size");

        List<String> diffs = new ArrayList<>();
        int count = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int expected = bytes.getInt();
                int got = actual.getRGB(x, y) & 0xffffff;
                if (expected != got) {
                    if (count++ < 5) {
                        diffs.add(String.format("(%d,%d) golden %06x, got %06x", x, y, expected, got));
                    }
                }
            }
        }
        if (count > 0) {
            fail(golden + ": " + count + " pixel(s) differ, first: " + String.join("; ", diffs));
        }
    }
}
