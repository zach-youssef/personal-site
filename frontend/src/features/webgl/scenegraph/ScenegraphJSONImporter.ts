import { IVertexData, VertexProducer } from "./common/IVertexData";
import { Scenegraph } from "./Scenegraph";
import { GroupNode } from "./GroupNode";
import { ObjImporter } from "./common/ObjImporter";
import { Mesh } from "./common/PolygonMesh";
import { SGNode } from "./SGNode";
import { TransformNode } from "./TransformNode";
import { mat4, vec3, vec4, glMatrix } from "gl-matrix";
import { LeafNode } from "./LeafNode";
import { Material } from "./common/Material";
import { Light } from "./common/Light";

export namespace ScenegraphJSONImporter {

    /**
     * This function parses a scenegraph specified in JSON format, and produces a scene graph
     * @param producer the vertex producer to load all the meshes used in the scene graph
     * @param contents the JSON string
     * @return a promise of a scene graph. The caller waits for the promise
     */
    export function importJSON<VertexType extends IVertexData>
        (producer: VertexProducer<VertexType>, contents: string): Promise<Scenegraph<VertexType>> {
        return new Promise<Scenegraph<VertexType>>((resolve, reject) => {
            let jsonTree: any = JSON.parse(contents);
            let scenegraph = new Scenegraph<VertexType>();
            let root: SGNode;

            if (!("instances" in jsonTree)) {
                throw new Error("No meshes in the scene graph!");
            }
            handleInstances(scenegraph, jsonTree["instances"], producer)
                .then((scenegraph: Scenegraph<VertexType>) => {
                    if (!("root" in jsonTree)) {
                        throw new Error("No root in the scene graph!");
                    }

                    root = handleNode(scenegraph, jsonTree["root"]);

                    scenegraph.makeScenegraph(root);

                    if ("images" in jsonTree) {
                        handleTextures(scenegraph, jsonTree["images"])
                    }

                    resolve(scenegraph);
                });

        });

    }

    function handleTextures(sg: Scenegraph<IVertexData>, images: any[]) {
        images.forEach(i => {
            if (!("name" in i && "path" in i)){
                throw new Error("Found bad texture desc!")
            } else {
                sg.addTexture(i["name"], i["path"])
            }
        })
    }

    export function handleNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: any): SGNode {
        let result: SGNode;
        if (!("type" in obj)) {
            throw new Error("No type of node!");
        }

        switch (obj["type"]) {
            case "transform":
                result = handleTransformNode(scenegraph, obj);
                break;
            case "group":
                result = handleGroupNode(scenegraph, obj);
                break;
            case "object":
                result = handleLeafNode(scenegraph, obj);
                break;
            default:
                throw new Error("Unknown node type");
        }

        if("lights" in obj) {
            result.setLights(parseLights(obj))
        }

        return result;
    }

    function parseLights(obj: any): Light[] {
        let lights: Light[] = []
        for (let light of obj["lights"]) {
            lights.push(handleLight(light))
        }
        return lights
    }

    function handleLight(obj: any): Light {
        let light: Light = new Light()

        if("ambient" in obj) {
            let values: number[] = convertToArray(obj["ambient"])
            assertVertexLen("ambient", 3, values)
            light.setAmbient(values)
        }
        if("diffuse" in obj) {
            let values: number[] = convertToArray(obj["diffuse"])
            assertVertexLen("diffuse", 3, values)
            light.setDiffuse(values)
        }
        if("specular" in obj) {
            let values: number[] = convertToArray(obj["specular"])
            assertVertexLen("specular", 3, values)
            light.setSpecular(values)
        }
        if("position" in obj) {
            let values: number[] = convertToArray(obj["position"])
            assertVertexLen("position", 4, values)
            light.setPosition(values)
        }
        if("spotdirection" in obj) {
            let values: number[] = convertToArray(obj["spotdirection"])
            assertVertexLen("spotdirection", 4, values)
            light.setSpotDirection(values)
        }
        if("spotcutoff" in obj) {
            light.setSpotAngle(Math.cos(parseFloat(obj["spotcutoff"]) * Math.PI / 180))
        } else {
            light.setSpotAngle(5);
        }

        return light
    }

    function assertVertexLen(propName: string, len:number, v: number[]): void{
        if (v.length != len){
            throw new Error(`${len} values needed for ${propName}!`)
        }
    }

    export function handleTransformNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: any): SGNode {
        let result: TransformNode;
        let nodeName: string = "t";
        let transform: mat4 = mat4.create();

        if ("name" in obj) {
            nodeName = obj["name"];
        }
        result = new TransformNode(scenegraph, nodeName);

        if (!("child" in obj)) {
            throw new Error("No child for a transform node");
        }

        if (!("transform" in obj)) {
            throw new Error("No transform property for a transform node");
        }

        for (let op of obj["transform"]) {
            if ("translate" in op) {
                let values: number[] = convertToArray(op["translate"]);
                if (values.length != 3) {
                    throw new Error("3 values needed for translate")
                }
                let translateBy: vec3 = vec3.fromValues(values[0], values[1], values[2]);
                mat4.translate(transform, transform, translateBy);
            }
            else if ("scale" in op) {
                let values: number[] = convertToArray(op["scale"]);
                if (values.length != 3) {
                    throw new Error("3 values needed for scale")
                }
                //console.log(values);
                let scaleBy: vec3 = vec3.fromValues(values[0], values[1], values[2]);
                mat4.scale(transform, transform, scaleBy);
            }
            else if ("rotate" in op) {
                let values: number[] = convertToArray(op["rotate"]);
                if (values.length != 4) {
                    throw new Error("4 values needed for rotate")
                }
                let rotateAngle: number = values[0];
                let rotateAxis: vec3 = vec3.fromValues(values[1], values[2], values[3]);
                mat4.rotate(transform, transform, glMatrix.toRadian(rotateAngle), rotateAxis);
            }
        }
        result.addChild(handleNode(scenegraph, obj["child"]));
        result.setTransform(transform);
        return result;
    }

    export function convertToArray(obj: any): number[] {
        let result: number[] = [];
        for (let n in obj) {
            result.push(parseFloat(obj[n]));
        }
        return result;
    }

    export function handleGroupNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: any): SGNode {
        let result: GroupNode;
        let nodeName: string = "g";

        if ("name" in obj) {
            nodeName = obj["name"];
        }
        result = new GroupNode(scenegraph, nodeName);
        for (let child of obj["children"]) {
            let node: SGNode = handleNode(scenegraph, child);
            result.addChild(node);
        }
        return result;
    }

    export function handleLeafNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: any): SGNode {
        let result: LeafNode;


        let nodeName: string = "g";

        if ("name" in obj) {
            nodeName = obj["name"];
        }
        let material: Material = new Material(); //all black by default
        result = new LeafNode(obj["instanceof"], scenegraph, nodeName);

        if ("material" in obj) {
            material = parseMaterial(obj["material"])
        }

        if ("texture" in obj) {
            result.setTextureName(obj["texture"]);
        }

        result.setMaterial(material);
        return result;
    }

    function parseMaterial(mat: any): Material {
        let material:Material = new Material()

        if ("color" in mat) {
            material.setAmbient(convertToArray(mat["color"]))
        }
        if ("ambient" in mat) {
            material.setAmbient(convertToArray(mat["ambient"]))
        }
        if ("diffuse" in mat) {
            material.setDiffuse(convertToArray(mat["diffuse"]))
        }
        if ("specular" in mat) {
            material.setSpecular(convertToArray(mat["specular"]))
        }
        if ("shininess" in mat) {
            material.setShininess(parseFloat(mat["shininess"]))
        }

        return material
    }

    export function handleInstances<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: any, producer: VertexProducer<VertexType>): Promise<Scenegraph<VertexType>> {
        return new Promise<Scenegraph<VertexType>>((resolve) => {
            let nameUrls: Map<string, string> = new Map<string, string>();
            for (let n of Object.keys(obj)) {
                let path: string = obj[n]["path"];
                nameUrls.set(obj[n]["name"], path);
            }

            //import them
            ObjImporter.batchDownloadMesh(nameUrls, producer)
                .then((meshMap: Map<string, Mesh.PolygonMesh<VertexType>>) => {
                    for (let [n, mesh] of meshMap) {
                        scenegraph.addPolygonMesh(n, mesh);
                    }
                    resolve(scenegraph);
                });
        });
    }
}