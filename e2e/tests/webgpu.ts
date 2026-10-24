// Chromium switches for the specs that run WebGPU pages, the same on every machine. Headless
// Chromium only offers WebGPU with --enable-unsafe-webgpu. --enable-gpu would give it a Mac's
// Metal GPU, but CI runners have no GPU, so the specs use SwiftShader everywhere:
// --use-angle=swiftshader puts WebGPU on SwiftShader (even beside --enable-gpu), and its canvases
// only present when Vulkan also runs on SwiftShader (--enable-features=Vulkan
// --use-vulkan=swiftshader); otherwise configuring one fails ("A valid external Instance reference
// no longer exists"). Launch options apply to a whole file, as they need their own browser.
export const WEBGPU_LAUNCH_OPTIONS = {
    args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'],
};
