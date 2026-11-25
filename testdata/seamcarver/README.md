# Seam carver goldens

What the original SeamCarving Java (the `graphql-server/src/java/SeamCarving` submodule, compiled
untouched) makes of each fixture. Every seam carver engine must reproduce them pixel for pixel. They
are written by `seamcarver-web/src/oracle/java/GoldenWriter.java` and checked by
`../graphql-server/gradlew -p seamcarver-web check` (see "Seam carver goldens" in the top-level
README.md); don't edit them by hand.

Each case is a pair of files:

- `<case>.in`: the input image.
- `<case>.out`: the Java's result. Its size is the case's target size: carve `<case>.in` to the
  width and height in `<case>.out`'s header.

Both use one format, with no compression:

| Offset | Size | Content |
|---|---|---|
| 0 | 4 | width, little-endian int32 |
| 4 | 4 | height, little-endian int32 |
| 8 | 4 x width x height | pixels, little-endian int32 `0x00RRGGBB` (8-bit R, G, B; the top byte is 0), rows top to bottom, each row left to right |

So a file is exactly `8 + 4 * width * height` bytes, and a little-endian reader can view the pixels
as a `Uint32Array` (Node), or in Rust with `u32::from_le_bytes` on each 4-byte chunk. The images are opaque 8-bit RGB, as the Java
sees a decoded PNG (`BufferedImage.TYPE_INT_RGB`), so an engine fed the same pixels from a PNG must
give the same result.

| Case | Input | Target | What it covers |
|---|---|---|---|
| `small-vertical` | 12x10 | 9x10 | vertical seams only |
| `small-horizontal` | 12x10 | 12x7 | horizontal seams only |
| `small-both` | 12x10 | 8x6 | all vertical seams, then all horizontal ones |
| `small-noop` | 12x10 | 12x10 | nothing to remove (`.out` equals `.in`) |
| `width-one` | 33x17 | 1x17 | carving down to a single column |
| `flat-ties` | 20x20 | 15x15 | two flat colours in 5x5 blocks: exact energy ties, so the tie-breaks decide |
| `medium` | 64x48 | 48x36 | a 25% carve |
| `large` | 120x90 | 90x70 | the largest, still under 50 KB per file |
| `e2e-gradient` | 60x40 | 45x32 | the end-to-end tests' upload, `gradientPng(60, 40)` in `e2e/tests/png.ts`, pixel for pixel |

The other inputs are a gradient with seeded noise, drawn by `GoldenWriter.input`.
