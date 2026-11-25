//! The WebAssembly face of [`crate::Carver`], exported as `Carver` by wasm-bindgen: the same
//! stepwise shape as the TeaVM build's `WebCarver`, so one worker loop drives both engines.
//! Dimensions are `u32` (JS numbers); every refusal is a thrown `Error` with the Rust message,
//! including `OutOfMemory` when the constructor can't reserve the image's buffers (the router's
//! cue to refuse or warn). Anything else that fails is a bug or a later allocation failure, and
//! with `panic = "abort"` it traps (`RuntimeError: unreachable`): the instance is then poisoned
//! (wasm-bindgen's borrow flag stays set and every later call throws "recursive use of an
//! object"), so a worker that sees a trap must be terminated and a fresh one started, never reused.

use wasm_bindgen::prelude::*;

/// One image being carved, step by step; see the crate documentation for the arithmetic.
#[wasm_bindgen(js_name = Carver)]
pub struct WasmCarver(crate::Carver);

fn js_error(e: crate::Error) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen(js_class = Carver)]
impl WasmCarver {
    /// Takes the image as row-major `0x00RRGGBB` pixels (a `Uint32Array`; the top byte is ignored).
    #[wasm_bindgen(constructor)]
    pub fn new(rgb: &[u32], width: u32, height: u32) -> Result<WasmCarver, JsError> {
        crate::Carver::new(rgb, width as usize, height as usize)
            .map(WasmCarver)
            .map_err(js_error)
    }

    pub fn width(&self) -> u32 {
        self.0.width() as u32
    }

    pub fn height(&self) -> u32 {
        self.0.height() as u32
    }

    /// Removes the next vertical seam; throws when the image is one pixel wide.
    pub fn step_vertical(&mut self) -> Result<(), JsError> {
        self.0.step_vertical().map_err(js_error)
    }

    /// Removes the next horizontal seam; throws when the image is one pixel high.
    pub fn step_horizontal(&mut self) -> Result<(), JsError> {
        self.0.step_horizontal().map_err(js_error)
    }

    /// The image as it is now: a `Uint32Array` of row-major `0x00RRGGBB` pixels.
    pub fn rgb(&self) -> Vec<u32> {
        self.0.rgb()
    }

    /// The Java `toEnergyImage`'s grey level of every pixel, a `Uint8Array` of `width * height`.
    pub fn energy_map(&self) -> Vec<u8> {
        self.0.energy_map()
    }

    /// The column, per row, of the vertical seam `step_vertical` would remove next.
    pub fn next_vertical_seam(&mut self) -> Vec<u32> {
        self.0.next_vertical_seam()
    }

    /// The row, per column, of the horizontal seam `step_horizontal` would remove next.
    pub fn next_horizontal_seam(&mut self) -> Vec<u32> {
        self.0.next_horizontal_seam()
    }
}
