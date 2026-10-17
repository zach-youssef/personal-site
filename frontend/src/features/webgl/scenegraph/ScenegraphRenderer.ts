import { ShaderLocationsVault } from "./common/ShaderLocationsVault"
import { RenderableMesh } from "./common/RenderableMesh"
import { IVertexData } from "./common/IVertexData";
import { Mesh } from "./common/PolygonMesh"
import { SGNode } from "./SGNode";
import { Stack } from "./common/Stack";
import { mat4, vec4 } from "gl-matrix";
import { Material } from "./common/Material";
import { Light } from "./common/Light";
import { TextureObject } from "./common/TextureObject";

/**
 * This is a scene graph renderer implementation that works specifically with WebGL.
 * @author Amit Shesh
 */
export class ScenegraphRenderer {
    protected gl: WebGLRenderingContext;
    /**
     * A table of shader locations and variable names
     */
    protected shaderLocations: ShaderLocationsVault;
    /**
     * A table of shader variables -> vertex attribute names in each mesh
     */
    protected shaderVarsToVertexAttribs: Map<string, string>;

    /**
     * 
     * A map to store all the textures
     */
    protected textures: Map<string, TextureObject>;
    /**
     * A table of renderers for individual meshes
     */
    protected meshRenderers: Map<String, RenderableMesh<IVertexData>>;


    /**
     * @param defaultTextureURL a white texture for leaves that don't name one, so they show their material's color
     */
    public constructor(gl: WebGLRenderingContext, shaderLocations: ShaderLocationsVault, shaderVarsToAttribs: Map<string, string>, defaultTextureURL: string) {
        this.gl = gl;
        this.shaderVarsToVertexAttribs = shaderVarsToAttribs;
        this.meshRenderers = new Map<String, RenderableMesh<IVertexData>>();
        this.textures = new Map<string, TextureObject>();
        this.addTexture("", defaultTextureURL)
        this.shaderLocations = shaderLocations;
    }


    /**
     * Add a mesh to be drawn later.
     * The rendering context should be set before calling this function, as this function needs it
     * This function creates a new
     * {@link RenderableMesh} object for this mesh
     * @param name the name by which this mesh is referred to by the scene graph
     * @param mesh the {@link PolygonMesh} object that represents this mesh
     * @throws Exception
     */
    public addMesh<K extends IVertexData>(meshName: string, mesh: Mesh.PolygonMesh<K>): void {
        if (meshName in this.meshRenderers)
            return;

        //verify that the mesh has all the vertex attributes as specified in the map
        if (mesh.getVertexCount() <= 0)
            return;
        let vertexData: K = mesh.getVertexAttributes()[0];
        for (let [s, a] of this.shaderVarsToVertexAttribs) {
            if (!vertexData.hasData(a))
                throw new Error("Mesh does not have vertex attribute " + a);
        }
        let renderableMesh: RenderableMesh<K> = new RenderableMesh<K>(this.gl, meshName);

        renderableMesh.initMeshForRendering(this.shaderVarsToVertexAttribs, mesh);

        this.meshRenderers.set(meshName, renderableMesh);
    }

    public addTexture(name: string, path: string): void {
        this.textures.set(name, new TextureObject(this.gl, name, path));
    }

    /**
     * Begin rendering of the scene graph from the root
     * @param root
     * @param modelView
     */
    public draw(root: SGNode, modelView: Stack<mat4>, lights: Light[]): void {
        this.sendLightsToShader(lights)
        root.draw(this, modelView);
    }

    public sendLightsToShader(lights: Light[]): void {
        for(let i = 0; i < lights.length; ++i) {
            // Send lights to shader
            let loc: WebGLUniformLocation | null = this.shaderLocations.getUniformLocation(`light[${i}].ambient`)
            this.gl.uniform3fv(loc, lights[i].getAmbient())
            loc = this.shaderLocations.getUniformLocation(`light[${i}].diffuse`)
            this.gl.uniform3fv(loc, lights[i].getDiffuse())
            loc = this.shaderLocations.getUniformLocation(`light[${i}].specular`)
            this.gl.uniform3fv(loc, lights[i].getSpecular())
            loc = this.shaderLocations.getUniformLocation(`light[${i}].position`)
            this.gl.uniform4fv(loc, lights[i].getPosition())
            loc = this.shaderLocations.getUniformLocation(`light[${i}].spotDirection`)
            this.gl.uniform4fv(loc, lights[i].getSpotDirection())
            loc = this.shaderLocations.getUniformLocation(`light[${i}].spotAngle`)
            this.gl.uniform1f(loc, lights[i].getSpotCutoff())
        }
    }

    public dispose(): void {
        for (let mesh of this.meshRenderers.values()) {
            mesh.cleanup();
        }
        for (let texture of this.textures.values()) {
            texture.dispose();
        }
    }

    /**
     * Draws a specific mesh.
     * If the mesh has been added to this renderer, it delegates to its correspond mesh renderer
     * This function first passes the mategraph. Since all of them are getting squished into that point (which happens to be 0,0,0), I would suspect that it is happening because somehow a matrix of all zeros is getting passed to the shader (or perhaps no matrix is getting passed to the shader).rial to the shader. Currently it uses the shader variable
     * "vColor" and passes it the ambient part of the material. When lighting is enabled, this 
     * method must be overriden to set the ambient, diffuse, specular, shininess etc. values to the 
     * shader
     * @param name
     * @param material
     * @param transformation
     */
    public drawMesh(meshName: string, material: Material, textureName: string, transformation: mat4) {
        if (this.meshRenderers.has(meshName)) {

            //Push the material properties
            let loc: WebGLUniformLocation | null = this.shaderLocations.getUniformLocation("material.ambient");
            this.gl.uniform3fv(loc, material.getAmbient());
            loc = this.shaderLocations.getUniformLocation("material.diffuse")
            this.gl.uniform3fv(loc, material.getDiffuse())
            loc = this.shaderLocations.getUniformLocation("material.specular")
            this.gl.uniform3fv(loc, material.getSpecular())
            loc = this.shaderLocations.getUniformLocation("material.shininess")
            this.gl.uniform1f(loc, material.getShininess())

            // Push the modelview and normal matrix
            loc = this.shaderLocations.getUniformLocation("modelview");
            this.gl.uniformMatrix4fv(loc, false, transformation);

            let normalMatrix: mat4 = mat4.clone(transformation)
            mat4.transpose(normalMatrix, normalMatrix)
            mat4.invert(normalMatrix, normalMatrix)
            loc = this.shaderLocations.getUniformLocation("normalmatrix")
            this.gl.uniformMatrix4fv(loc, false, normalMatrix)

            // Send texture to shader
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.uniform1i(this.shaderLocations.getUniformLocation("image"), 0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.get(textureName)!.getTextureID());
            // Enable mipmapping
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            // Prevent wrapping
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT)
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT)

            this.meshRenderers.get(meshName)!.draw(this.shaderLocations);
        }
    }
}