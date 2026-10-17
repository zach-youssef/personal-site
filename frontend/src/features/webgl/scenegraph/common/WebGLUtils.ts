/**
 * Utilities useful to set up WebGL shaders. This code has been heavily borrowed from the code that accompanies "WebGL Programming Guide: Interactive 3D Graphics Programming with WebGL" by Matsuda and Lea
 */

/**
   * A helper function to create the shader program, given the shader sources.
   * @param gl the WebGLRenderingContext that can be used to call WebGL functions
   * @param vShaderSource the source of the vertex shader, as a string
   * @param fShaderSource the source of the fragment shader, as a string
   * @return the shader program object, as a WebGLProgram object
   */
export function createShaderProgram(gl: WebGLRenderingContext, vShaderSource: string, fShaderSource: string): WebGLProgram {
  //create a new shader program
  let program: WebGLProgram = gl.createProgram()!;

  //create a shader object for the vertex shader
  let vShader: WebGLShader = createShader(gl, vShaderSource, gl.VERTEX_SHADER);

  //create a shader object for the fragment shader
  let fShader: WebGLShader = createShader(gl, fShaderSource, gl.FRAGMENT_SHADER);

  //attach the vertex shader to the program
  gl.attachShader(program, vShader);
  //attach the fragment shader to the program
  gl.attachShader(program, fShader);

  //now "link" the program. This links together the two shaders into one program
  gl.linkProgram(program);
  //the program keeps the shaders it was linked from, so they can be freed along with it
  gl.deleteShader(vShader);
  gl.deleteShader(fShader);
  //verify that the shader program was successfully linked
  let success: number = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    //something went wrong when linking the program; get the error
    throw new Error("Could not link shader: " + gl.getProgramInfoLog(program));
  }

  return program;
}

/**
 * A helper function to create a new shader program, given its source.
 * @param gl the WebGLRenderingContext that can be used to call WebGL functions
 * @param source the source of the shader, as a string
 * @param shaderType the type of the shader (ehter VERTEX_SHADER or FRAGMENT_SHADER)
 * @return the shader object, as a WebGLShader
 */
export function createShader(gl: WebGLRenderingContext, source: string, shaderType: number): WebGLShader {
  let shader: WebGLShader = gl.createShader(shaderType)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  // Check if it compiled
  let success: number = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    // Something went wrong during compilation; get the error
    throw new Error("could not compile my shader:" + source + ":" + gl.getShaderInfoLog(shader));
  }
  return shader;
}
