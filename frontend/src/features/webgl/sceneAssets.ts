import { SceneAssets } from './scenegraph/Controller';
import scene from './assets/hogwarts.json?url';
import cameraPath from './assets/camerapath.txt?url';
import defaultTexture from './assets/textures/default_white_mipmap.png';

// The build copies these into its assets with hashed names, keyed here by their source path.
// They're downloaded only when the demo asks for them.
const files = import.meta.glob<string>('./assets/{models,textures}/*', { query: '?url', import: 'default', eager: true });

// The castle scene and the files it names, which are bundled with the frontend
export const sceneAssets: SceneAssets = {
    scene,
    cameraPath,
    defaultTexture,
    resolve(path: string): string {
        const url = files[`./assets/${path}`];
        if (url === undefined) {
            throw new Error(`The scene names ${path}, which isn't in webgl/assets`);
        }
        return url;
    },
};
