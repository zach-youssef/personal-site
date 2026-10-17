import { mat4, vec3, vec4 } from "gl-matrix"
import { Scenegraph } from "./Scenegraph"
import { Stack } from "./common/Stack";
import { ScenegraphRenderer } from "./ScenegraphRenderer";
import { Material } from "./common/Material";
import { IVertexData } from "./common/IVertexData";
import { Light } from "./common/Light"
/**
 * This class represents a basic node of a scene graph.
 */
export abstract class SGNode {
    /**
      * The name given to this node
    */
    protected name!: string;
    /**
     * The parent of this node. Each node except the root has a parent. The root's parent is null
     */
    protected parent: SGNode | null;
    /**
     * A reference to the {@link sgraph.IScenegraph} object that this is part of
     */
    protected scenegraph: Scenegraph<IVertexData>;

    /**
     * If set to false, this node will not be drawn (and neither will its children, if any)
     */
    protected shouldDraw: boolean;

    /**
     *  All lights at this node.
     */
    protected lights: Light[]

    constructor(graph: Scenegraph<IVertexData>, name: string) {
        this.parent = null;
        this.scenegraph = graph;
        this.setName(name);
        this.shouldDraw = true
        this.lights = []
    }

    /**
     * By default, this method checks only itself. Nodes that have children should override this
     * method and navigate to children to find the one with the correct name
     * @param name name of node to be searched
     * @return the node whose name this is, null otherwise
     */
    public getNode(name: string): SGNode | null {
        if (this.name == name) {
            return this;
        }
        return null;
    }

    /**
     * Sets the parent of this node
     * @param parent the node that is to be the parent of this node
     */

    public setParent(parent: SGNode): void {
        this.parent = parent;
    }

    /**
     * Sets the scene graph object whose part this node is and then adds itself
     * to the scenegraph (in case the scene graph ever needs to directly access this node)
     * @param graph a reference to the scenegraph object of which this tree is a part
     */
    public setScenegraph(graph: Scenegraph<IVertexData>): void {
        this.scenegraph = graph;
        graph.addNode(this.name, this);
    }

    /**
     * Sets the name of this node
     * @param name the name of this node
     */
    public setName(name: string): void {
        this.name = name;
    }

    /**
     * Gets the name of this node
     * @return the name of this node
     */
    public getName(): string {
        return this.name;
    }

    public abstract draw(context: ScenegraphRenderer, modelView: Stack<mat4>): void;
    public abstract clone(): SGNode;
    public setTransform(transform: mat4): void {
        throw new Error("Not supported");
    }
    public setAnimationTransform(transform: mat4): void {
        throw new Error("Not supported");
    };

    public setMaterial(mat: Material): void {
        throw new Error("Not supported");
    }

    public getMaterial(): Material {
        throw new Error("Not supported");
    }

    public setShouldDraw(shouldDraw: boolean): void {
        this.shouldDraw = shouldDraw;
    }

    public setLights(lights: Light[]):void {
        this.lights = lights;
    }

    public abstract getLights(m: mat4): Light[]

    protected transformLight(light: Light, m: mat4): Light {
        let lightT = new Light();
        lightT.setAmbient(light.getAmbient())
        lightT.setDiffuse(light.getDiffuse())
        lightT.setSpecular(light.getSpecular())
        lightT.setSpotAngle(light.getSpotCutoff())
        

        let newPos = vec4.create()
        vec4.transformMat4(newPos, light.getPosition(), m)
        lightT.setPosition(this.vec4To3(newPos))

        let newDir = vec4.create()
        vec4.transformMat4(newDir, light.getSpotDirection(), m)
        lightT.setSpotDirection(this.vec4To3(newDir))

        return lightT
    }

    vec4To3(v: vec4): vec3 {
        let nV = vec3.create()
        nV[0] = v[0]/v[3]
        nV[1] = v[2]/v[3]
        nV[2] = v[3]/v[3]
        return nV
    }
}