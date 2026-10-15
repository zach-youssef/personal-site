import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const SEAM_CARVER_DIR = resolve(__dirname, '../../graphql-server/assets/seamcarver');

// The seam carver upload route writes to these gitignored directories, relative to the
// backend's working directory, and fails if they don't exist
export default function globalSetup() {
    for (const dir of ['input', 'output']) {
        mkdirSync(resolve(SEAM_CARVER_DIR, dir), { recursive: true });
    }

    // Remove the carved images the tests produce
    const outputDir = resolve(SEAM_CARVER_DIR, 'output');
    const existing = new Set(readdirSync(outputDir));
    return () => {
        for (const file of readdirSync(outputDir).filter(file => !existing.has(file))) {
            rmSync(resolve(outputDir, file));
        }
    };
}
