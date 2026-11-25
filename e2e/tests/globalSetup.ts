import { existsSync, readdirSync } from 'node:fs';
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
        // An empty directory (another worktree's, say) counts as unbuilt, dotfiles such as the
        // .DS_Store Finder leaves aside
        if (!existsSync(dir) || readdirSync(dir).every(name => name.startsWith('.'))) {
            throw new Error(`Nothing built in ${dir}: run ${script} first`);
        }
    }
}
