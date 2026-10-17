import { View } from "./View"

/**
 * Where the demo's files are served from
 */
export interface SceneAssets {
    /** The scene graph, in JSON */
    scene: string;
    /** The plane's path: a line with the number of points, then a line per point */
    cameraPath: string;
    /** A white texture for objects that don't name one */
    defaultTexture: string;
    /** Maps a file the scene graph names, like models/cone.obj, to where it's served */
    resolve(path: string): string;
}

export class Controller {
    private view: View;

    constructor(view: View) {
        this.view = view;
    }

    private static async fetchText(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Couldn't load ${url}: ${response.status}`);
        }
        return response.text();
    }

    // The scene graph names its meshes and textures by path, so point those at where they're served
    private static resolvePaths(json: string, resolve: (path: string) => string): string {
        const scene = JSON.parse(json);
        for (const file of [...(scene.instances ?? []), ...(scene.images ?? [])]) {
            file.path = resolve(file.path);
        }
        return JSON.stringify(scene);
    }

    private parseCameraPath(rawCameraPath: string): Array<Array<number>> {
        let lines: string[] = rawCameraPath.split(/\r?\n/).map(line => line.trim())
        let path: Array<Array<number>> = new Array()
        for (let index: number = 1; index <= parseInt(lines[0]); ++index) {
            path.push(lines[index].split(/\s+/).map(item => parseFloat(item)))
        }
        return path;
    }

    /**
     * Downloads the scene and hands it to the view; the view draws nothing until then
     */
    public async go(assets: SceneAssets): Promise<void> {
        // Neither download depends on the other
        const [json, cameraPath] = await Promise.all([
            Controller.fetchText(assets.scene),
            Controller.fetchText(assets.cameraPath),
        ]);
        await this.view.initScenegraph(
            Controller.resolvePaths(json, assets.resolve),
            this.parseCameraPath(cameraPath),
            this.getPhongVShader(),
            Controller.getPhongFShader,
            assets.defaultTexture);
    }

    public getPhongVShader(): string {
        return `
        attribute vec4 vPosition;
        attribute vec4 vNormal;
        attribute vec2 vTexCoord;
        
        uniform mat4 projection;
        uniform mat4 modelview;
        uniform mat4 normalmatrix;
        varying vec3 fNormal;
        varying vec4 fPosition;
        varying vec4 fTexCoord;
        
        void main()
        {
            vec3 lightVec,viewVec,reflectVec;
            vec3 normalView;
            vec3 ambient,diffuse,specular;
        
            fPosition = modelview * vPosition;
            gl_Position = projection * fPosition;
        
        
            vec4 tNormal = normalmatrix * vNormal;
            fNormal = normalize(tNormal.xyz);

            fTexCoord = vec4(vTexCoord.s, vTexCoord.t, 0, 1);
        }
        
    `;
    }

    public static getPhongFShader(numLights: number): string {
        return `precision mediump float;

        struct MaterialProperties
        {
            vec3 ambient;
            vec3 diffuse;
            vec3 specular;
            float shininess;
        };
        
        struct LightProperties
        {
            vec3 ambient;
            vec3 diffuse;

            vec3 specular;
            vec4 position;

            vec4 spotDirection;
            float spotAngle;
        };
        
        
        varying vec3 fNormal;
        varying vec4 fPosition;
        varying vec4 fTexCoord;
        
        uniform MaterialProperties material;
        uniform LightProperties light[` + numLights + `];
        uniform sampler2D image;
        
        void main()
        {
            vec3 lightVec,viewVec,reflectVec;
            vec3 normalView, normalSpotVec;
            vec3 ambient,diffuse,specular;
            float nDotL,rDotV,sDotL;
            vec4 result;
        
            result = vec4(0,0,0,1);
        `
            + `for (int i=0;i<` + numLights + `;i++)
            {
                if (light[i].position.w!=0.0)
                    lightVec = normalize(light[i].position.xyz - fPosition.xyz);
                else
                    lightVec = normalize(-light[i].position.xyz);
        
                normalSpotVec = normalize(light[i].spotDirection.xyz);
                sDotL = dot(normalSpotVec, -lightVec);

                if (sDotL >= light[i].spotAngle || light[i].spotAngle == 5.0) {
                    vec3 tNormal = fNormal;
                    normalView = normalize(tNormal.xyz);
                    nDotL = dot(normalView,lightVec);
            
                    viewVec = -fPosition.xyz;
                    viewVec = normalize(viewVec);
            
                    reflectVec = reflect(-lightVec,normalView);
                    reflectVec = normalize(reflectVec);
            
                    rDotV = max(dot(reflectVec,viewVec),0.0);
            
                    ambient = material.ambient * light[i].ambient;
                    diffuse = material.diffuse * light[i].diffuse * max(nDotL,0.0);
                    if (nDotL>0.0)
                        specular = material.specular * light[i].specular * pow(max(rDotV,0.0),material.shininess);
                    else
                        specular = vec3(0,0,0);
                    result = result + vec4(ambient+diffuse+specular,1.0);    
                }
            }
            result = result * texture2D(image, fTexCoord.st);
            gl_FragColor = result;
        }
        
    `;
    }

}