//! Timings for the slow-warning estimate (`cargo bench`, native): a 1 MP and a 12 MP image, each
//! carved to 75% of its width, as the plan's benchmark asks. Prints the time and the cost per
//! pixel-seam (one DP cell), the constant the page's estimate `k x pixels x seams` needs; the
//! WebAssembly figure comes from `node node-check.mjs <dir> --bench`.

use seamcarver_flat::carve;
use std::time::Instant;

/// GoldenWriter's NOISY_GRADIENT at any size (the pattern, not a committed fixture).
fn noisy_gradient(width: usize, height: usize, seed: u32) -> Vec<u32> {
    let mut state = u64::from(seed);
    let mut rgb = Vec::with_capacity(width * height);
    let clamp = |v: i64| v.clamp(0, 255) as u32;
    for y in 0..height {
        for x in 0..width {
            state = (state * 1103515245 + 12345) & 0x7fff_ffff;
            let noise = ((state >> 16) % 64) as i64 - 32;
            let (x, y, w, h) = (x as i64, y as i64, width as i64, height as i64);
            let r = clamp(x * 255 / w + noise);
            let g = clamp(y * 255 / h - noise);
            let b = clamp((x + y) * 255 / (w + h) + noise / 2);
            rgb.push((r << 16) | (g << 8) | b);
        }
    }
    rgb
}

fn time(name: &str, width: usize, height: usize) {
    let rgb = noisy_gradient(width, height, 7);
    let target = width * 3 / 4;
    let seams = width - target;
    let start = Instant::now();
    let out = carve(&rgb, width, height, target, height).unwrap();
    let elapsed = start.elapsed();
    assert_eq!(out.len(), target * height);
    // Each seam costs a pass over the image at its size then; the mean size is close enough
    let cells = (width + target) as f64 / 2.0 * height as f64 * seams as f64;
    println!(
        "{name}: {width}x{height} -> {target}x{height} ({seams} seams) in {:.2} s, {:.2} ns per pixel-seam",
        elapsed.as_secs_f64(),
        elapsed.as_secs_f64() * 1e9 / cells
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    time("1 MP", 1152, 868);
    if !args.iter().any(|a| a == "--quick") {
        time("12 MP", 4000, 3000);
    }
}
