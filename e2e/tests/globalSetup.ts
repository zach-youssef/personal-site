import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

// The backend writes carved images here, relative to its working directory
const OUTPUT_DIR = resolve(__dirname, '../../graphql-server/assets/seamcarver/output');

const listOutputs = () => existsSync(OUTPUT_DIR) ? readdirSync(OUTPUT_DIR) : [];

// Remove the carved images the tests produce
export default function globalSetup() {
    const existing = new Set(listOutputs());
    return () => {
        for (const file of listOutputs().filter(file => !existing.has(file))) {
            rmSync(resolve(OUTPUT_DIR, file));
        }
    };
}
