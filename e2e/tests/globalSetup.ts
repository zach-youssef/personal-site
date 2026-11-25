import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The PPU's games, ZGAL's examples, the splat viewer with its scene and the seam carver's web
// engines, which the backend serves for their pages, the splat specs' fixture scene, and the
// scripts that build them
const BUILT_ASSETS = [
    [resolve(__dirname, '../../graphql-server/assets/ppu'), './build-ppu'],
    [resolve(__dirname, '../../graphql-server/assets/zgal'), './build-zgal'],
    [resolve(__dirname, '../../graphql-server/assets/splat'), './build-splat'],
    [resolve(__dirname, '../fixtures/splat'), './build-splat'],
    [resolve(__dirname, '../../graphql-server/assets/seamcarver-web'), './build-seamcarver'],
];

// Refuse to start without the builds, whose absence would fail many specs in unrelated-looking ways
export default function globalSetup() {
    for (const [dir, script] of BUILT_ASSETS) {
        if (!existsSync(dir)) {
            throw new Error(`Nothing built in ${dir}: run ${script} first`);
        }
    }
}
