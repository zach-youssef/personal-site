//! The engine must reproduce every golden in `testdata/seamcarver` pixel for pixel (the format is
//! in its README.md), and behave at the edges the goldens don't reach.

use seamcarver_flat::{Carver, Error, carve};
use std::fs;
use std::path::{Path, PathBuf};

/// A `.in` or `.out` file: little-endian int32 width and height, then `0x00RRGGBB` int32 pixels.
struct Image {
    width: usize,
    height: usize,
    rgb: Vec<u32>,
}

fn read_image(path: &Path) -> Image {
    let bytes = fs::read(path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    let int = |i: usize| u32::from_le_bytes(bytes[4 * i..4 * i + 4].try_into().unwrap());
    let (width, height) = (int(0) as usize, int(1) as usize);
    assert_eq!(
        bytes.len(),
        8 + 4 * width * height,
        "{}: size",
        path.display()
    );
    Image {
        width,
        height,
        rgb: (2..2 + width * height).map(int).collect(),
    }
}

fn goldens_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../testdata/seamcarver")
}

/// Every case, by name, with its input and the Java's output. `SEAMCARVER_GOLDENS=<dir>` runs
/// the "every golden" tests over another set in the same format instead (e.g. a batch of random
/// cases written by the Java oracle, to check more than the committed nine).
fn cases() -> Vec<(String, Image, Image)> {
    let dir = std::env::var_os("SEAMCARVER_GOLDENS").map_or_else(goldens_dir, PathBuf::from);
    let mut names: Vec<String> = fs::read_dir(&dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|x| x == "in"))
        .map(|p| p.file_stem().unwrap().to_str().unwrap().to_owned())
        .collect();
    names.sort();
    assert!(
        names.len() >= 9,
        "only {} goldens in {}",
        names.len(),
        dir.display()
    );
    names
        .into_iter()
        .map(|name| {
            let input = read_image(&dir.join(format!("{name}.in")));
            let output = read_image(&dir.join(format!("{name}.out")));
            (name, input, output)
        })
        .collect()
}

fn case(name: &str) -> (Image, Image) {
    let dir = goldens_dir();
    (
        read_image(&dir.join(format!("{name}.in"))),
        read_image(&dir.join(format!("{name}.out"))),
    )
}

/// Fails on the first differing pixels, as GoldenTest does.
fn assert_same_pixels(name: &str, expected: &Image, actual: &[u32]) {
    assert_eq!(actual.len(), expected.rgb.len(), "{name}: pixel count");
    let differing: Vec<String> = (0..actual.len())
        .filter(|&i| actual[i] != expected.rgb[i])
        .map(|i| {
            format!(
                "({}, {}): {:06x} != {:06x}",
                i % expected.width,
                i / expected.width,
                actual[i],
                expected.rgb[i]
            )
        })
        .collect();
    assert!(
        differing.is_empty(),
        "{name}: {} of {} pixels differ (actual != golden), first: {}",
        differing.len(),
        actual.len(),
        differing
            .iter()
            .take(5)
            .cloned()
            .collect::<Vec<_>>()
            .join(", ")
    );
}

#[test]
fn carve_matches_every_golden() {
    for (name, input, output) in cases() {
        let actual = carve(
            &input.rgb,
            input.width,
            input.height,
            output.width,
            output.height,
        )
        .unwrap();
        assert_same_pixels(&name, &output, &actual);
    }
}

/// The worker's loop: one step at a time, with the size and the next seam asked along the way.
#[test]
fn stepping_matches_every_golden() {
    for (name, input, output) in cases() {
        let mut carver = Carver::new(&input.rgb, input.width, input.height).unwrap();
        while carver.width() > output.width {
            let seam = carver.next_vertical_seam();
            assert_eq!(seam.len(), carver.height(), "{name}: a column per row");
            let (before, width) = (carver.rgb(), carver.width());
            carver.step_vertical().unwrap();
            assert_eq!(
                carver.width(),
                width - 1,
                "{name}: width after a vertical step"
            );
            // The step removed exactly the seam it announced
            let expected: Vec<u32> = before
                .chunks(width)
                .zip(&seam)
                .flat_map(|(row, &c)| {
                    let c = c as usize;
                    assert!(c < width, "{name}: seam column {c} in a row of {width}");
                    row[..c].iter().chain(&row[c + 1..]).copied()
                })
                .collect();
            assert_eq!(
                carver.rgb(),
                expected,
                "{name}: the announced seam was removed"
            );
        }
        while carver.height() > output.height {
            let seam = carver.next_horizontal_seam();
            assert_eq!(seam.len(), carver.width(), "{name}: a row per column");
            let (before, width, height) = (carver.rgb(), carver.width(), carver.height());
            carver.step_horizontal().unwrap();
            assert_eq!(
                carver.height(),
                height - 1,
                "{name}: height after a horizontal step"
            );
            // Each column loses its seam pixel; the pixels below it move up
            let mut expected = vec![0; width * (height - 1)];
            for x in 0..width {
                assert!(
                    (seam[x] as usize) < height,
                    "{name}: seam row {} in a column of {height}",
                    seam[x]
                );
                let mut ny = 0;
                for y in 0..height {
                    if seam[x] as usize != y {
                        expected[ny * width + x] = before[y * width + x];
                        ny += 1;
                    }
                }
            }
            assert_eq!(
                carver.rgb(),
                expected,
                "{name}: the announced seam was removed"
            );
        }
        assert_eq!(
            (carver.width(), carver.height()),
            (output.width, output.height),
            "{name}"
        );
        assert_same_pixels(&name, &output, &carver.rgb());
    }
}

/// The incremental energy update after a removal must equal recomputing every pixel.
#[test]
fn energy_cache_stays_exact() {
    for name in [
        "large",
        "flat-ties",
        "width-one",
        "height-one",
        "row-one",
        "column-one",
    ] {
        let (input, output) = case(name);
        let mut carver = Carver::new(&input.rgb, input.width, input.height).unwrap();
        assert_eq!(
            carver.cached_energies(),
            carver.fresh_energies(),
            "{name}: initial"
        );
        for i in output.width..input.width {
            carver.step_vertical().unwrap();
            assert_eq!(
                carver.cached_energies(),
                carver.fresh_energies(),
                "{name}: v step {i}"
            );
        }
        for i in output.height..input.height {
            carver.step_horizontal().unwrap();
            assert_eq!(
                carver.cached_energies(),
                carver.fresh_energies(),
                "{name}: h step {i}"
            );
        }
    }
}

/// Asking the other direction transposes the arrays; the answers must not depend on the layout.
#[test]
fn layout_changes_are_invisible() {
    let (input, _) = case("medium");
    let mut a = Carver::new(&input.rgb, input.width, input.height).unwrap();
    let mut b = a.clone();
    let vertical = a.next_vertical_seam();
    let horizontal = a.next_horizontal_seam();
    assert_eq!(a.next_vertical_seam(), vertical);
    assert_eq!(b.next_horizontal_seam(), horizontal);
    assert_eq!(b.next_vertical_seam(), vertical);
    assert_eq!(a.rgb(), input.rgb);
    assert_eq!(b.rgb(), input.rgb);
    assert_eq!(a.energy_map(), b.energy_map());
    a.step_vertical().unwrap();
    b.step_vertical().unwrap();
    assert_eq!(a.rgb(), b.rgb());
    assert_eq!(a.energy_map(), b.energy_map());
    assert_eq!(a.cached_energies(), a.fresh_energies());
}

/// The Java's own `toEnergyImage` of a golden input (`<case>.energy`, grey in every channel).
#[test]
fn energy_map_matches_the_javas_golden() {
    let (input, _) = case("e2e-gradient");
    let golden = read_image(&goldens_dir().join("e2e-gradient.energy"));
    assert_eq!((golden.width, golden.height), (input.width, input.height));
    let carver = Carver::new(&input.rgb, input.width, input.height).unwrap();
    let grey: Vec<u32> = carver
        .energy_map()
        .iter()
        .map(|&v| u32::from(v) * 0x010101)
        .collect();
    assert_same_pixels("e2e-gradient.energy", &golden, &grey);
}

#[test]
fn energy_map_is_the_javas_grey_scale() {
    let (input, _) = case("medium");
    let carver = Carver::new(&input.rgb, input.width, input.height).unwrap();
    let energies = carver.fresh_energies();
    let max = energies.iter().cloned().fold(0.0, f64::max);
    let expected: Vec<u8> = energies
        .iter()
        .map(|&e| ((e / max) * 255.0) as i32 as u8)
        .collect();
    assert_eq!(carver.energy_map(), expected);
    assert!(expected.contains(&255), "the maximum maps to 255");
    // A flat grey image still has energy at its edges (the outside counts as brightness 0); only
    // an all-black one has none anywhere, and then 0 / 0 is NaN, which (int) makes 0
    let grey = Carver::new(&[0x808080; 12], 4, 3).unwrap();
    assert_eq!(grey.energy_map()[5], 0, "an inner pixel of a flat image");
    // A top-edge pixel misses 3 neighbours: energy 3b; a corner misses 5: sqrt(8) b, 240 of 255
    assert_eq!(grey.energy_map()[1], 255, "an edge pixel of a flat image");
    assert_eq!(grey.energy_map()[0], 240, "a corner of a flat image");
    let black = Carver::new(&[0x000000; 12], 4, 3).unwrap();
    assert_eq!(black.energy_map(), vec![0; 12]);
}

#[test]
fn a_no_op_target_returns_the_input() {
    let (input, output) = case("small-noop");
    assert_eq!(output.rgb, input.rgb, "the golden is the input");
    let actual = carve(
        &input.rgb,
        input.width,
        input.height,
        input.width,
        input.height,
    )
    .unwrap();
    assert_eq!(actual, input.rgb);
}

#[test]
fn the_top_byte_of_a_pixel_is_dropped() {
    let (input, output) = case("medium");
    let opaque: Vec<u32> = input.rgb.iter().map(|p| p | 0xff00_0000).collect();
    let actual = carve(
        &opaque,
        input.width,
        input.height,
        output.width,
        output.height,
    )
    .unwrap();
    assert_same_pixels("medium with alpha", &output, &actual);
}

#[test]
fn carving_to_one_by_one_works() {
    let (input, _) = case("medium");
    let actual = carve(&input.rgb, input.width, input.height, 1, 1).unwrap();
    assert_eq!(actual.len(), 1);
    let mut carver = Carver::new(&input.rgb, input.width, input.height).unwrap();
    carver.carve_to(1, 1).unwrap();
    assert_eq!(carver.rgb(), actual);
    assert_eq!(
        carver.step_vertical(),
        Err(Error::NothingToRemove {
            width: 1,
            height: 1
        })
    );
    assert_eq!(
        carver.step_horizontal(),
        Err(Error::NothingToRemove {
            width: 1,
            height: 1
        })
    );
    assert_eq!(carver.next_vertical_seam(), vec![0]);
    assert_eq!(carver.next_horizontal_seam(), vec![0]);
}

#[test]
fn invalid_targets_are_refused_without_a_change() {
    let (input, _) = case("small-vertical");
    let (w, h) = (input.width, input.height);
    let bad = |tw, th| Error::BadTarget {
        width: w,
        height: h,
        target_width: tw,
        target_height: th,
    };
    assert_eq!(carve(&input.rgb, w, h, 0, h), Err(bad(0, h)));
    assert_eq!(carve(&input.rgb, w, h, w, 0), Err(bad(w, 0)));
    assert_eq!(carve(&input.rgb, w, h, w + 1, h), Err(bad(w + 1, h)));
    assert_eq!(carve(&input.rgb, w, h, w, h + 1), Err(bad(w, h + 1)));
    let mut carver = Carver::new(&input.rgb, w, h).unwrap();
    assert_eq!(carver.carve_to(w + 1, h - 1), Err(bad(w + 1, h - 1)));
    assert_eq!((carver.width(), carver.height()), (w, h));
    assert_eq!(carver.rgb(), input.rgb);
    // After a step the bounds are the current size
    carver.step_vertical().unwrap();
    assert_eq!(
        carver.carve_to(w, h),
        Err(Error::BadTarget {
            width: w - 1,
            height: h,
            target_width: w,
            target_height: h
        })
    );
}

#[test]
fn errors_name_the_sizes() {
    assert_eq!(
        Carver::new(&[0; 6], 4, 2).unwrap_err().to_string(),
        "a 4x2 image needs 8 pixels, got 6"
    );
    assert_eq!(
        carve(&[0; 6], 3, 2, 4, 1).unwrap_err().to_string(),
        "target 4x1 must be between 1x1 and the image's 3x2"
    );
    let mut one = Carver::new(&[0; 2], 1, 2).unwrap();
    assert_eq!(
        one.step_vertical().unwrap_err().to_string(),
        "a 1x2 image can't lose another seam that way"
    );
    one.step_horizontal().unwrap();
    assert_eq!((one.width(), one.height()), (1, 1));
}
