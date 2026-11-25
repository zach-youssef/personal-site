#!/bin/sh
# Builds the seam carver's Rust engine to WebAssembly with its JS glue (an ES module for the
# browser's worker and Node) into the given directory: <out>/flat.js, <out>/flat_bg.wasm and the
# .d.ts files. Needs the toolchain in rust-toolchain.toml (rustup installs it on first use) and
# wasm-bindgen-cli at exactly the crate's wasm-bindgen version: `build.sh wasm-bindgen-version`
# prints that version (from Cargo.lock) for `cargo install --locked wasm-bindgen-cli --version`.
set -eu

# The output directory is the caller's, relative to its cwd, so make it absolute before moving
# into the crate (whose Cargo.lock and target/ the rest needs)
out=
case ${1:-} in
    "" | -h | --help | wasm-bindgen-version) ;;
    *)
        mkdir -p "$1"
        out=$(cd "$1" && pwd)
        ;;
esac
cd "$(dirname "$0")"

want=$(awk '/^name = "wasm-bindgen"$/ { found = 1 } found && /^version = / { gsub(/"/, "", $3); print $3; exit }' Cargo.lock)
if [ -z "${want}" ]; then
    echo "build.sh: no wasm-bindgen in Cargo.lock" >&2
    exit 1
fi

case ${1:-} in
    wasm-bindgen-version)
        echo "${want}"
        exit 0
        ;;
    "" | -h | --help)
        echo "usage: build.sh <out dir> | build.sh wasm-bindgen-version" >&2
        exit 2
        ;;
esac

have=$(wasm-bindgen --version 2>/dev/null | awk '{ print $2 }') || true
if [ "${have}" != "${want}" ]; then
    echo "build.sh: wasm-bindgen-cli ${want} is needed (found '${have:-none}'):" >&2
    echo "  cargo install --locked wasm-bindgen-cli --version ${want}" >&2
    exit 1
fi

cargo build --release --target wasm32-unknown-unknown --quiet
wasm-bindgen --target web --out-dir "${out}" --out-name flat \
    target/wasm32-unknown-unknown/release/seamcarver_flat.wasm
echo "built ${out}/flat.js and flat_bg.wasm ($(wc -c < "${out}/flat_bg.wasm" | tr -d ' ') bytes)"
