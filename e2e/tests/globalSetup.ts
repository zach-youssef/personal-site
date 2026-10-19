import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

// The backend writes carved images here, relative to its working directory
const OUTPUT_DIR = resolve(__dirname, '../../graphql-server/assets/seamcarver/output');

const listOutputs = () => existsSync(OUTPUT_DIR) ? readdirSync(OUTPUT_DIR) : [];

// The PPU's games, which the backend serves for the PPU page
const PPU_DIR = resolve(__dirname, '../../graphql-server/assets/ppu');

// Remove the carved images the tests produce
export default function globalSetup() {
    if (!existsSync(PPU_DIR)) {
        throw new Error(`No PPU games in ${PPU_DIR}: run ./build-ppu first`);
    }
    const existing = new Set(listOutputs());
    return () => {
        for (const file of listOutputs().filter(file => !existing.has(file))) {
            rmSync(resolve(OUTPUT_DIR, file));
        }
    };
}
