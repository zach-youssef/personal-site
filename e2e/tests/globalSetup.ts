import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

// The backend writes carved images here, relative to its working directory
const OUTPUT_DIR = resolve(__dirname, '../../graphql-server/assets/seamcarver/output');

const listOutputs = () => existsSync(OUTPUT_DIR) ? readdirSync(OUTPUT_DIR) : [];

// The PPU's games and ZGAL's examples, which the backend serves for their pages, and the
// scripts that build them
const BUILT_ASSETS = [
    [resolve(__dirname, '../../graphql-server/assets/ppu'), './build-ppu'],
    [resolve(__dirname, '../../graphql-server/assets/zgal'), './build-zgal'],
];

// Remove the carved images the tests produce
export default function globalSetup() {
    for (const [dir, script] of BUILT_ASSETS) {
        if (!existsSync(dir)) {
            throw new Error(`Nothing built in ${dir}: run ${script} first`);
        }
    }
    const existing = new Set(listOutputs());
    return () => {
        for (const file of listOutputs().filter(file => !existing.has(file))) {
            rmSync(resolve(OUTPUT_DIR, file));
        }
    };
}
