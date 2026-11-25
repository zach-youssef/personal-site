//! The seam carver's flat-array engine: what the original SeamCarving Java
//! (`seamcarver-web/SeamCarving`, a graph of `Pixel` objects) computes, on plain arrays.
//! Pixel-identical by construction and by the goldens in `testdata/seamcarver` (`tests/goldens.rs`).
//!
//! # What the Java does, and where this does the same
//!
//! - Brightness of a pixel: `(r + g + b) / (3.0 * 255.0)` (`Pixel.brightness`), an integer sum
//!   divided once; a missing neighbour (`NoPixel`) has brightness 0. See [`brightness`].
//! - Energy: `sqrt(pow(v, 2) + pow(h, 2))` with `v = ((tl + l) + dl) - tr - r - dr` and
//!   `h = ((tl + u) + tr) - dl - d - dr` summed in exactly that order (`Pixel.verticalEnergy`,
//!   `horizontalEnergy`, `energy`). `Math.pow(x, 2)` is `x * x` on every JVM (fdlibm's special
//!   case, C2's intrinsic), so [`Carver::energy_at`] multiplies. Rust never contracts `a * a + b *
//!   b` into a fused multiply-add and `f64::sqrt` is IEEE correctly rounded, as `Math.sqrt` is.
//! - Vertical seam: every pixel's seam weight is the best weight among its TOP_LEFT, UP, TOP_RIGHT
//!   neighbours, in that order, plus its own energy; a candidate replaces the best only when
//!   strictly smaller, so the first minimum wins (`Pixel.updateSeam`, `SeamInfo.betterSeamInfo`).
//!   The seam ends at the leftmost strict minimum of the bottom row (`GraphImage.nextVerticalSeam`
//!   walks it left to right). See [`Carver::find_seam`].
//! - Removal shifts the pixels right of the seam one step left (`Pixel.remove(LEFT)`): the graph's
//!   re-linking leaves it a rectangular grid, which is the array with the seam's pixel dropped
//!   from every row. Energies are recomputed by the Java on every use, so they are a pure function
//!   of the current grid: this caches them and recomputes only the pixels whose 3x3 neighbourhood
//!   changed (see [`Carver::remove_seam`]).
//! - Horizontal seams (`Pixel.updateSeamHorizontally`: TOP_LEFT, LEFT, DOWN_LEFT; the end is the
//!   topmost strict minimum of the right column) are the vertical algorithm on the transposed
//!   image: transposing maps those candidates, in order, onto TOP_LEFT, UP, TOP_RIGHT, the right
//!   column onto the bottom row, and swaps the two energy terms, whose sum is commutative, so every
//!   value is bit-identical. The engine transposes lazily when the requested direction changes.
//! - `SeamCarver.carve` removes all vertical seams first, then all horizontal ones
//!   ([`Carver::carve_to`], [`carve`]). A target outside `1..=size` is an error here; the Java
//!   would return the original size or fail inside AWT.
//! - `toEnergyImage` draws each pixel grey `(int) ((energy / maxEnergy) * 255.0)`
//!   (`Pixel.greyscaleValue`); [`Carver::energy_map`] gives those bytes.
//!
//! Pixels are `0x00RRGGBB` as in `testdata/seamcarver/README.md`; the top byte is ignored on input.

use std::fmt;

#[cfg(target_arch = "wasm32")]
mod wasm;

/// Why a request was refused. Panics never signal anything but a bug.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    /// `width * height` isn't the pixel count, or a dimension is 0.
    BadImage {
        width: usize,
        height: usize,
        pixels: usize,
    },
    /// A target below 1 or above the current size.
    BadTarget {
        width: usize,
        height: usize,
        target_width: usize,
        target_height: usize,
    },
    /// A seam step on an image already one pixel wide or high.
    NothingToRemove { width: usize, height: usize },
    /// The image's buffers (about 13 bytes per pixel) couldn't be allocated.
    OutOfMemory { width: usize, height: usize },
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::BadImage {
                width,
                height,
                pixels,
            } => match width.checked_mul(*height) {
                Some(needed) => {
                    write!(
                        f,
                        "a {width}x{height} image needs {needed} pixels, got {pixels}"
                    )
                }
                None => write!(
                    f,
                    "a {width}x{height} image has more pixels than can be counted"
                ),
            },
            Error::BadTarget {
                width,
                height,
                target_width,
                target_height,
            } => write!(
                f,
                "target {target_width}x{target_height} must be between 1x1 and the image's {width}x{height}"
            ),
            Error::NothingToRemove { width, height } => {
                write!(
                    f,
                    "a {width}x{height} image can't lose another seam that way"
                )
            }
            Error::OutOfMemory { width, height } => {
                write!(f, "not enough memory for a {width}x{height} image")
            }
        }
    }
}

impl std::error::Error for Error {}

/// Which way the engine's arrays are laid out: row-major as the image, or transposed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Layout {
    Image,
    Transposed,
}

/// One image being carved, step by step.
///
/// The arrays are row-major in the current [`Layout`]; `width` and `height` are the layout's. In
/// [`Layout::Image`] a "vertical" seam is a vertical seam of the image; in [`Layout::Transposed`]
/// it is a horizontal one.
#[derive(Debug, Clone)]
pub struct Carver {
    layout: Layout,
    width: usize,
    height: usize,
    /// `0x00RRGGBB` per pixel.
    rgb: Vec<u32>,
    /// Each pixel's energy on the current grid.
    energy: Vec<f64>,
    /// The next vertical seam of the current layout, when `seam_valid`: a column per row.
    seam: Vec<u32>,
    seam_valid: bool,
    /// Scratch for [`Carver::find_seam`]: which predecessor each pixel's seam came from
    /// (0 = TOP_LEFT, 1 = UP, 2 = TOP_RIGHT) and the two rolling rows of seam weights.
    back: Vec<u8>,
    weights: [Vec<f64>; 2],
}

/// `Pixel.brightness`: `(red + blue + green) / (3.0 * 255.0)`, the integer sum divided once.
#[inline]
pub fn brightness(rgb: u32) -> f64 {
    let sum = ((rgb >> 16) & 0xff) + ((rgb >> 8) & 0xff) + (rgb & 0xff);
    f64::from(sum) / (3.0 * 255.0)
}

/// Carves `rgb` (row-major `0x00RRGGBB`, `width * height` pixels) to `target_width` x
/// `target_height` as `SeamCarver.carve` does: all vertical seams, then all horizontal ones.
pub fn carve(
    rgb: &[u32],
    width: usize,
    height: usize,
    target_width: usize,
    target_height: usize,
) -> Result<Vec<u32>, Error> {
    let mut carver = Carver::new(rgb, width, height)?;
    carver.carve_to(target_width, target_height)?;
    Ok(carver.rgb())
}

impl Carver {
    /// Takes the image as row-major `0x00RRGGBB` pixels (the top byte is ignored).
    ///
    /// The per-pixel buffers (rgb, energy, back-pointers: 13 bytes a pixel) are reserved here, so
    /// an image too large for the memory at hand is refused with [`Error::OutOfMemory`] rather
    /// than failing mid-carve. Later allocations are smaller: a direction change holds one extra
    /// copy of rgb, then of energy, while transposing (12 bytes a pixel at the peak), and
    /// [`Carver::rgb`] copies 4 bytes a pixel; those fail the usual way (in WebAssembly, a trap).
    pub fn new(rgb: &[u32], width: usize, height: usize) -> Result<Carver, Error> {
        if width == 0 || height == 0 || width.checked_mul(height) != Some(rgb.len()) {
            return Err(Error::BadImage {
                width,
                height,
                pixels: rgb.len(),
            });
        }
        let pixels = rgb.len();
        let out_of_memory = |_| Error::OutOfMemory { width, height };
        let mut carver = Carver {
            layout: Layout::Image,
            width,
            height,
            rgb: Vec::new(),
            energy: Vec::new(),
            seam: Vec::new(),
            seam_valid: false,
            back: Vec::new(),
            weights: [Vec::new(), Vec::new()],
        };
        carver
            .rgb
            .try_reserve_exact(pixels)
            .map_err(out_of_memory)?;
        carver
            .energy
            .try_reserve_exact(pixels)
            .map_err(out_of_memory)?;
        carver
            .back
            .try_reserve_exact(pixels)
            .map_err(out_of_memory)?;
        carver.rgb.extend(rgb.iter().map(|p| p & 0x00ff_ffff));
        carver.energy.resize(pixels, 0.0);
        for y in 0..height {
            for x in 0..width {
                carver.energy[y * width + x] = carver.energy_at(x, y);
            }
        }
        Ok(carver)
    }

    /// The image's current width.
    pub fn width(&self) -> usize {
        match self.layout {
            Layout::Image => self.width,
            Layout::Transposed => self.height,
        }
    }

    /// The image's current height.
    pub fn height(&self) -> usize {
        match self.layout {
            Layout::Image => self.height,
            Layout::Transposed => self.width,
        }
    }

    /// Removes the next vertical seam (`GraphImage.removeVerticalSeam`).
    pub fn step_vertical(&mut self) -> Result<(), Error> {
        self.set_layout(Layout::Image);
        self.step()
    }

    /// Removes the next horizontal seam (`GraphImage.removeHorizontalSeam`).
    pub fn step_horizontal(&mut self) -> Result<(), Error> {
        self.set_layout(Layout::Transposed);
        self.step()
    }

    /// Carves to the target as `SeamCarver.carve` does: every vertical seam, then every
    /// horizontal one. Nothing changes when the target is refused.
    pub fn carve_to(&mut self, target_width: usize, target_height: usize) -> Result<(), Error> {
        let (width, height) = (self.width(), self.height());
        if !(1..=width).contains(&target_width) || !(1..=height).contains(&target_height) {
            return Err(Error::BadTarget {
                width,
                height,
                target_width,
                target_height,
            });
        }
        for _ in target_width..width {
            self.step_vertical()?;
        }
        for _ in target_height..height {
            self.step_horizontal()?;
        }
        Ok(())
    }

    /// The image as it is now, row-major `0x00RRGGBB`.
    pub fn rgb(&self) -> Vec<u32> {
        match self.layout {
            Layout::Image => self.rgb.clone(),
            Layout::Transposed => transpose(&self.rgb, self.width, self.height),
        }
    }

    /// `GraphImage.toEnergyImage`'s grey level of every pixel, row-major:
    /// `(int) ((energy / maxEnergy) * 255.0)`, with `maxEnergy` the largest energy in the image
    /// (`GraphImage.maxEnergy`). A flat image (every energy 0) divides 0 by 0: NaN, which the
    /// cast makes 0, as Java's does.
    pub fn energy_map(&self) -> Vec<u8> {
        let max = self.energy.iter().fold(0.0_f64, |max, &e| e.max(max));
        let grey = |e: f64| ((e / max) * 255.0) as i32 as u8;
        match self.layout {
            Layout::Image => self.energy.iter().map(|&e| grey(e)).collect(),
            Layout::Transposed => transpose(&self.energy, self.width, self.height)
                .into_iter()
                .map(grey)
                .collect(),
        }
    }

    /// The column, per row, of the vertical seam [`Carver::step_vertical`] would remove next.
    pub fn next_vertical_seam(&mut self) -> Vec<u32> {
        self.set_layout(Layout::Image);
        self.find_seam();
        self.seam.clone()
    }

    /// The row, per column, of the horizontal seam [`Carver::step_horizontal`] would remove next.
    pub fn next_horizontal_seam(&mut self) -> Vec<u32> {
        self.set_layout(Layout::Transposed);
        self.find_seam();
        self.seam.clone()
    }

    /// Each pixel's energy as it is now, for checking the cache against [`Carver::energy_at`].
    #[doc(hidden)]
    pub fn cached_energies(&self) -> Vec<f64> {
        match self.layout {
            Layout::Image => self.energy.clone(),
            Layout::Transposed => transpose(&self.energy, self.width, self.height),
        }
    }

    /// Each pixel's energy computed afresh from the pixels, in image layout.
    #[doc(hidden)]
    pub fn fresh_energies(&self) -> Vec<f64> {
        let mut fresh = Vec::with_capacity(self.energy.len());
        for y in 0..self.height {
            for x in 0..self.width {
                fresh.push(self.energy_at(x, y));
            }
        }
        match self.layout {
            Layout::Image => fresh,
            Layout::Transposed => transpose(&fresh, self.width, self.height),
        }
    }

    /// Removes the next vertical seam of the current layout.
    fn step(&mut self) -> Result<(), Error> {
        if self.width == 1 {
            return Err(Error::NothingToRemove {
                width: self.width(),
                height: self.height(),
            });
        }
        self.find_seam();
        self.remove_seam();
        Ok(())
    }

    /// Transposes the arrays when they aren't in `layout`. Costs one pass over the image, as a
    /// seam step does, so alternating directions is at most twice as slow as one direction.
    fn set_layout(&mut self, layout: Layout) {
        if self.layout == layout {
            return;
        }
        self.rgb = transpose(&self.rgb, self.width, self.height);
        self.energy = transpose(&self.energy, self.width, self.height);
        std::mem::swap(&mut self.width, &mut self.height);
        self.layout = layout;
        self.seam_valid = false;
    }

    /// `Pixel.energy` of the pixel at column `x`, row `y` of the current layout, from its eight
    /// neighbours' brightness (0 outside the image), summed in the Java's order.
    #[inline]
    fn energy_at(&self, x: usize, y: usize) -> f64 {
        let (w, h) = (self.width, self.height);
        let at = |x: usize, y: usize| brightness(self.rgb[y * w + x]);
        let (left, right) = (x > 0, x + 1 < w);
        let (up, down) = (y > 0, y + 1 < h);
        let pick = |ok: bool, x: usize, y: usize| if ok { at(x, y) } else { 0.0 };
        let tl = pick(left && up, x.wrapping_sub(1), y.wrapping_sub(1));
        let u = pick(up, x, y.wrapping_sub(1));
        let tr = pick(right && up, x + 1, y.wrapping_sub(1));
        let l = pick(left, x.wrapping_sub(1), y);
        let r = pick(right, x + 1, y);
        let dl = pick(left && down, x.wrapping_sub(1), y + 1);
        let d = pick(down, x, y + 1);
        let dr = pick(right && down, x + 1, y + 1);
        // Pixel.verticalEnergy: + TOP_LEFT, LEFT, DOWN_LEFT; - TOP_RIGHT, RIGHT, DOWN_RIGHT
        let vertical = tl + l + dl - tr - r - dr;
        // Pixel.horizontalEnergy: + TOP_LEFT, UP, TOP_RIGHT; - DOWN_LEFT, DOWN, DOWN_RIGHT
        let horizontal = tl + u + tr - dl - d - dr;
        (vertical * vertical + horizontal * horizontal).sqrt()
    }

    /// `GraphImage.nextVerticalSeam` on the current layout, into `self.seam` (a no-op while the
    /// grid hasn't changed since the last call).
    fn find_seam(&mut self) {
        if self.seam_valid {
            return;
        }
        let (w, h) = (self.width, self.height);
        self.back.clear();
        self.back.resize(w * h, 1);
        for row in &mut self.weights {
            row.clear();
            row.resize(w, 0.0);
        }
        let [mut prev, mut cur] = std::mem::take(&mut self.weights);
        for y in 0..h {
            let energy = &self.energy[y * w..(y + 1) * w];
            let back = &mut self.back[y * w..(y + 1) * w];
            if y == 0 {
                // Every candidate is a NoPixel, whose seam (NoInfo) weighs 0: 0 + energy
                cur.copy_from_slice(energy);
            } else {
                for x in 0..w {
                    // Pixel.updateSeam over TOP_LEFT, UP, TOP_RIGHT: a NoInfo (a missing
                    // neighbour) loses to anything, a SeamInfo only to a strictly smaller one
                    let (mut best, mut from) = if x > 0 {
                        (prev[x - 1], 0)
                    } else {
                        (prev[x], 1)
                    };
                    if x > 0 && prev[x] < best {
                        best = prev[x];
                        from = 1;
                    }
                    if x + 1 < w && prev[x + 1] < best {
                        best = prev[x + 1];
                        from = 2;
                    }
                    cur[x] = best + energy[x];
                    back[x] = from;
                }
            }
            std::mem::swap(&mut prev, &mut cur);
        }
        // The bottom row's leftmost strict minimum ends the seam
        let mut end = 0;
        for x in 1..w {
            if prev[x] < prev[end] {
                end = x;
            }
        }
        self.weights = [prev, cur];
        self.seam.clear();
        self.seam.resize(h, 0);
        self.seam[h - 1] = end as u32;
        for y in (1..h).rev() {
            let x = self.seam[y] as usize;
            let from = self.back[y * w + x] as usize;
            self.seam[y - 1] = (x + from - 1) as u32;
        }
        self.seam_valid = true;
    }

    /// Drops `self.seam`'s pixel from every row (`SeamInfo.removeVertical`: each pixel's right
    /// neighbours shift one step left) and brings the energy cache up to date.
    fn remove_seam(&mut self) {
        debug_assert!(self.seam_valid && self.width > 1);
        let (w, h) = (self.width, self.height);
        let nw = w - 1;
        for y in 0..h {
            let c = self.seam[y] as usize;
            // Row y moves from y*w to y*nw (never past a row not yet moved) without pixel c
            let (from, to) = (y * w, y * nw);
            self.rgb.copy_within(from..from + c, to);
            self.rgb.copy_within(from + c + 1..from + w, to + c);
            self.energy.copy_within(from..from + c, to);
            self.energy.copy_within(from + c + 1..from + w, to + c);
        }
        self.rgb.truncate(nw * h);
        self.energy.truncate(nw * h);
        self.width = nw;
        self.seam_valid = false;
        // A pixel's energy changes when its 3x3 neighbourhood does. In row y, with the seam at
        // column c, the new columns c-1 and c gained a new neighbour in their own row; the rows
        // above and below lost their seam pixel at a column within one of c, so the new columns
        // c-2 to c+1 may see a changed neighbour there, and no column further away can: for
        // x >= c+2, every neighbour was at x+1 before, and for x <= c-3, none moved.
        for y in 0..h {
            let c = self.seam[y] as usize;
            let first = c.saturating_sub(2);
            let last = (c + 1).min(nw - 1);
            for x in first..=last {
                self.energy[y * nw + x] = self.energy_at(x, y);
            }
        }
    }
}

/// `src` as a `width` x `height` row-major grid, transposed into a `height` x `width` one.
fn transpose<T: Copy + Default>(src: &[T], width: usize, height: usize) -> Vec<T> {
    debug_assert_eq!(src.len(), width * height);
    let mut out = vec![T::default(); src.len()];
    // Blocked so both the reads and the writes stay within a few cache lines at a time
    const BLOCK: usize = 32;
    for y0 in (0..height).step_by(BLOCK) {
        for x0 in (0..width).step_by(BLOCK) {
            for y in y0..(y0 + BLOCK).min(height) {
                for x in x0..(x0 + BLOCK).min(width) {
                    out[x * height + y] = src[y * width + x];
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brightness_is_the_sum_divided_once() {
        assert_eq!(brightness(0x000000), 0.0);
        assert_eq!(brightness(0xffffff), 1.0);
        assert_eq!(brightness(0x010203), 6.0 / 765.0);
        assert_eq!(brightness(0xff010203), 6.0 / 765.0);
    }

    #[test]
    fn transpose_round_trips() {
        let src: Vec<u32> = (0..12).collect();
        let t = transpose(&src, 4, 3);
        assert_eq!(t, vec![0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11]);
        assert_eq!(transpose(&t, 3, 4), src);
    }

    #[test]
    fn rejects_a_wrong_pixel_count() {
        assert_eq!(
            Carver::new(&[0; 5], 2, 3).unwrap_err(),
            Error::BadImage {
                width: 2,
                height: 3,
                pixels: 5
            }
        );
        assert_eq!(
            Carver::new(&[], 0, 3).unwrap_err(),
            Error::BadImage {
                width: 0,
                height: 3,
                pixels: 0
            }
        );
    }

    #[test]
    fn an_uncountable_image_is_still_described() {
        let e = Error::BadImage {
            width: usize::MAX,
            height: 2,
            pixels: 0,
        };
        assert_eq!(
            e.to_string(),
            format!(
                "a {}x2 image has more pixels than can be counted",
                usize::MAX
            )
        );
        assert_eq!(Carver::new(&[], usize::MAX, 2).unwrap_err(), e);
    }

    #[test]
    fn energy_of_a_single_pixel_is_zero() {
        let c = Carver::new(&[0x123456], 1, 1).unwrap();
        assert_eq!(c.energy, vec![0.0]);
        assert_eq!(c.energy_map(), vec![0]);
    }
}
