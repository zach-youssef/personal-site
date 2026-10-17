import { SGNode } from "./SGNode"
import { Scenegraph } from "./Scenegraph";
import { Material } from "./common/Material";
import { Stack } from "./common/Stack";
import { ScenegraphRenderer } from "./ScenegraphRenderer";
import { mat4 } from "gl-matrix";
import { IVertexData } from "./common/IVertexData";
import { Light } from "./common/Light";

/**
 * This node represents the leaf of a scene graph. It is the only type of node that has
 * actual geometry to render.
 * @author Amit Shesh
 */

export class LeafNode extends SGNode {

    /**
      * The name of the object instance that this leaf contains. All object instances are stored
      * in the scene graph itself, so that an instance can be reused in several leaves
      */
    protected meshName: string;
    /**
     * The material associated with the object instance at this leaf
     */
    protected material: Material = new Material();

    protected textureName: string;

    public constructor(instanceOf: string, graph: Scenegraph<IVertexData>, name: string) {
        super(graph, name);
        this.meshName = instanceOf;
        this.textureName = "";
    }



    /*
	 *Set the material of each vertex in this object
	 */
    public setMaterial(mat: Material): void {
        this.material = mat;
    }

    /**
     * Set texture ID of the texture to be used for this leaf
     * @param name
     */
    public setTextureName(name: string): void {
        this.textureName = name;
    }

    /*
     * gets the material
     */
    public getMaterial(): Material {
        return this.material;
    }

    public clone(): SGNode {
        let newclone: SGNode = new LeafNode(this.meshName, this.scenegraph, this.name);
        newclone.setMaterial(this.getMaterial());
        return newclone;
    }


    /**
     * Delegates to the scene graph for rendering. This has two advantages:
     * <ul>
     *     <li>It keeps the leaf light.</li>
     *     <li>It abstracts the actual drawing to the specific implementation of the scene graph renderer</li>
     * </ul>
     * @param context the generic renderer context {@link sgraph.IScenegraphRenderer}
     * @param modelView the stack of modelview matrices
     * @throws IllegalArgumentException
     */
    public draw(context: ScenegraphRenderer, modelView: Stack<mat4>): void {
        if (this.shouldDraw && this.meshName.length > 0) {
            context.drawMesh(this.meshName, this.material, this.textureName, modelView.peek());
        }
    }

    public getLights(m: mat4): Light[] {
        return this.lights.map(l => this.transformLight(l, m))
    }
}