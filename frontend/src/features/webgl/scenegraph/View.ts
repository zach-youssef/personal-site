import { vec4, mat4, vec3, glMatrix } from "gl-matrix";
import * as WebGLUtils from "./common/WebGLUtils";
import { Stack } from "./common/Stack"
import { Scenegraph } from "./Scenegraph";
import { VertexPNT, VertexPNTProducer } from "./VertexPNT";
import { ShaderLocationsVault } from "./common/ShaderLocationsVault";
import { ScenegraphRenderer } from "./ScenegraphRenderer";
import { Mesh } from "./common/PolygonMesh";
import { ScenegraphJSONImporter } from "./ScenegraphJSONImporter"
import { LeafNode } from "./LeafNode";
import { TransformNode } from "./TransformNode";
import { SGNode } from "./SGNode";
import { Material } from "./common/Material";
import { GroupNode } from "./GroupNode";

export enum CameraMode{
    Top,
    Front,
    Rotate,
    Plane, 
    Ground
}
/**
 * This class encapsulates the "view", where all of our WebGL code resides. This class, for now, also stores all the relevant data that is used to draw. This can be replaced with a more formal Model-View-Controller architecture with a bigger application.
 */
export class View {
    //the webgl rendering context. All WebGL functions will be called on this object
    private gl: WebGLRenderingContext;
    //an object that represents a WebGL shader
    private shaderProgram: WebGLProgram | null;

    //a projection matrix, that encapsulates how what we draw corresponds to what is seen
    private proj!: mat4;

    //a modelview matrix, that encapsulates all the transformations applied to our object
    private modelview: Stack<mat4>;

    private scenegraph: Scenegraph<VertexPNT> | null;
    private shaderLocations!: ShaderLocationsVault;

    private time: number;
    private planeSpeed: number;
    private turnSpeed: number;

    private modelJson: string;

    private cameraMode!: CameraMode;

    private shouldDrawPath: boolean;

    private disposed: boolean;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        this.time = 0;
        this.modelview = new Stack<mat4>();
        this.shaderProgram = null;
        this.scenegraph = null;
        this.modelJson = "";
        this.shouldDrawPath = false
        this.disposed = false;

        this.planeSpeed = 2;
        this.turnSpeed = 0.01;

        this.gl.clearColor(0.9, 0.9, 0.7, 1);

        this.setCameraMode(CameraMode.Front);
    }

    private genCameraMesh(path: number[][]): Mesh.PolygonMesh<VertexPNT> {
        let vertices: VertexPNT[] = []
        let indices: number[] = []

        // Draw every other vertex as buffer is not big enough
        for(let index: number = 0; index < path.length; index+=2) {
            let currentPosition = path[index]
            let vertexPNT: VertexPNT = new VertexPNT();
            vertexPNT.setData("position", [
                 currentPosition[0], 
                 currentPosition[1],
                 currentPosition[2]])
            vertices.push(vertexPNT)
            indices.push(index / 2)
        }

        let pathMesh = new Mesh.PolygonMesh<VertexPNT>()
        pathMesh.setVertexData(vertices)
        pathMesh.setPrimitives(indices, Mesh.FaceType.LineLoop)

        return pathMesh
    }

    public setCameraMode(cameraMode: CameraMode) {
        this.cameraMode = cameraMode;

        if (this.cameraMode == CameraMode.Top) {
            this.proj = mat4.ortho(mat4.create(), -100, 100, -100, 100, 0.1, 10000);
        } else {
            this.proj = mat4.perspective(mat4.create(), glMatrix.toRadian(100), 1.0, 0.1, 10000)
        }
    }

    public setDrawPath(shouldDrawPath: boolean) {
        this.shouldDrawPath = shouldDrawPath
        // Before the scene graph loads, the path node picks this up when it's made
        this.scenegraph?.getNodes().get("PlanePath")?.setShouldDraw(this.shouldDrawPath)
    }

    public initShaders(vShaderSource: string, fShaderSource: string) {
        //create and set up the shader
        this.shaderProgram = WebGLUtils.createShaderProgram(this.gl, vShaderSource, fShaderSource);
        //enable the current program
        this.gl.useProgram(this.shaderProgram);

        this.shaderLocations = new ShaderLocationsVault(this.gl, this.shaderProgram);

    }

    private getPathNode(scenegraph: Scenegraph<VertexPNT>): SGNode {
        let material: Material = new Material()
        material.init()
        material.setAmbient(vec3.fromValues(1.0, 0.5, 0.0))

        let leafNode = new LeafNode("planePath", scenegraph, "pathObj")
        leafNode.setMaterial(material)

        let transformParent = new TransformNode(scenegraph, "PlanePath")
        transformParent.addChild(leafNode)
        transformParent.setShouldDraw(this.shouldDrawPath)
        return transformParent;
    }

    public initScenegraph(
        modelJson: string,
        pathData: number[][],
        vShaderSource: string,
        fShaderSource: (numLights: number) => string,
        defaultTextureURL: string
        ): Promise<void> {
        this.modelJson = modelJson;
        return ScenegraphJSONImporter.importJSON(new VertexPNTProducer(), this.modelJson)
            .then((s: Scenegraph<VertexPNT>) => {
                // Nothing has been sent to WebGL yet, so there's nothing to free
                if (this.disposed) {
                    return;
                }
                this.scenegraph = s;
                s.addPolygonMesh("planePath", this.genCameraMesh(pathData))

                let pathNode = this.getPathNode(s)
                this.scenegraph.addNode("PlanePath", pathNode)

                let root = this.scenegraph.getRoot()
                if (root instanceof GroupNode){
                    root.addChild(pathNode)
                } else {
                    console.log("Unable to add plane path to model")
                }
                this.scenegraph.addAnimationData("broom", pathData, View.planeAnimator)

                this.initShaders(vShaderSource, fShaderSource(this.getNumLights()))

                let shaderVarsToVertexAttribs: Map<string, string> = new Map<string, string>();
                shaderVarsToVertexAttribs.set("vPosition", "position");
                shaderVarsToVertexAttribs.set("vNormal", "normal");
                shaderVarsToVertexAttribs.set("vTexCoord", "texcoord");
                let renderer: ScenegraphRenderer = new ScenegraphRenderer(this.gl, this.shaderLocations, shaderVarsToVertexAttribs, defaultTextureURL);

                this.scenegraph.setRenderer(renderer)
            });
    }

    private static planeAnimator (time:number, data:number[][]): mat4 {
        let w: vec3 = vec3.create();
        let u: vec3 = vec3.create();
        let v: vec3 = vec3.create()
        let m: mat4 = mat4.create();

        let planeIndex = time * 2;
        let currentData = data[planeIndex % data.length]
        let nextData = data[(planeIndex  + 1) % data.length]

        let currentPosition: vec3 = vec3.fromValues(currentData[0], currentData[1], currentData[2]);
        let nextPosition: vec3 = vec3.fromValues(nextData[0], nextData[1], nextData[2]);

        v = vec3.fromValues(currentData[3], currentData[4], currentData[5]);
        vec3.normalize(v, v);

        vec3.subtract(w, nextPosition, currentPosition);
        vec3.normalize(w, w);

        vec3.cross(u, v, w);

        // Change plane's coordinate system
        mat4.set(m, 
            u[0], u[1], u[2], 0,
            v[0], v[1], v[2], 0,
            w[0], w[1], w[2], 0,
            0, 0, 0, 1);

        let aeroplaneAnimation = mat4.create();

        mat4.translate(aeroplaneAnimation, aeroplaneAnimation, currentPosition);
        mat4.multiply(aeroplaneAnimation, aeroplaneAnimation, m);

        return aeroplaneAnimation;
    }

    public animate(): void {
        if (this.time == Number.MAX_SAFE_INTEGER) {
            this.time = 0;
        } else {
            this.time += 1;
        }

        if (this.scenegraph != null) {
            this.scenegraph.animate(this.time)
        }
    }

    public draw(): void {

        // The canvas is resized to fit the page, so the viewport follows it
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.enable(this.gl.DEPTH_TEST);

        if (this.scenegraph == null || this.shaderProgram == null) {
            return;
        }

        this.gl.useProgram(this.shaderProgram)

        while (!this.modelview.isEmpty())
            this.modelview.pop();

        /*
         *In order to change the shape of this triangle, we can either move the vertex positions above, or "transform" them
         * We use a modelview matrix to store the transformations to be applied to our triangle.
         * Right now this matrix is identity, which means "no transformations"
         */
        this.modelview.push(mat4.create());
        this.modelview.push(mat4.clone(this.modelview.peek()));

        switch(this.cameraMode) {
            case(CameraMode.Front):
                mat4.lookAt(this.modelview.peek(), vec3.fromValues(95, 75, 75), vec3.fromValues(60, 25, -27.5), vec3.fromValues(0, 1, 0))
                break;
            case(CameraMode.Top):
                mat4.lookAt(this.modelview.peek(), vec3.fromValues(75, 100, -35), vec3.fromValues(75, 25, -35), vec3.fromValues(0, 0, -1));
                break;
            case(CameraMode.Rotate):
                let viewDistance = 100;
                let centerX = 60;
                let centerZ = -27.5;
                let x: number = centerX + (viewDistance * Math.cos(this.time * this.turnSpeed))
                let z: number = centerZ - (viewDistance * Math.sin(this.time * this.turnSpeed))
                mat4.lookAt(this.modelview.peek(), vec3.fromValues(x, 75, z), vec3.fromValues(centerX, 25, centerZ), vec3.fromValues(0, 1, 0))
                break;
            case(CameraMode.Plane):
                mat4.lookAt(this.modelview.peek(), 
                    vec3.fromValues(0, 0, 3),
                    vec3.fromValues(0, 0, 3.1),
                    vec3.fromValues(0, 1, 0))

                let aeroplaneInverse = mat4.create();
                let plane = this.scenegraph.getNodes().get("broom")
                if (plane instanceof TransformNode) {
                    mat4.invert(aeroplaneInverse, plane.getAnimationTransform())
                }
                mat4.multiply(this.modelview.peek(), this.modelview.peek(), aeroplaneInverse)
                break;
            case(CameraMode.Ground):
                let currentData = this.scenegraph.getKeyframeData("broom",this.time * this.planeSpeed);
                mat4.lookAt(this.modelview.peek(), 
                    vec3.fromValues(75, 5, -90), 
                    vec3.fromValues(currentData[0], currentData[1], currentData[2]), 
                    vec3.fromValues(0, 1, 0))
                break;    
        }

        this.gl.uniformMatrix4fv(this.shaderLocations.getUniformLocation("projection"), false, this.proj);

        this.scenegraph.draw(this.modelview);
    }

    /**
     * Frees everything this view sent to WebGL
     */
    public dispose(): void {
        this.disposed = true;
        this.scenegraph?.dispose();
        if (this.shaderProgram != null) {
            this.gl.deleteProgram(this.shaderProgram);
        }
    }

    public getNumLights(): number {
        return this.scenegraph!.getLights(mat4.create()).length
    }
}