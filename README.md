# EaglerLite
EaglerLite is a highly optimized, plug-and-play Eaglercraft 1.12.2 launcher designed to maximize FPS and minimize system resource usage without changing the vanilla experience. This repository contains the latest stable HTML launcher with the client scripts pre-injected.

HOW IT WORKS: EaglerLite operates by injecting a self-contained JavaScript optimizer into the game window prior to WebGL context creation. The wrapper intercepts low-level rendering APIs—specifically `getContext`, `bufferData`, `uniformMatrix4fv`, and `requestAnimationFrame`—to safely tune the GPU, track vertex buffer objects (VBOs), and extract the view frustum. Quality-of-life features like Fullbright are achieved by directly mutating the lightmap short-integers inside the VBO arrays during upload, entirely bypassing the need to modify game textures.

WHY IT WORKS: The reason EaglerLite yields such high framerates is because it targets the primary bottlenecks of TeaVM-compiled JavaScript: CPU stalls and GPU fill-rate. By implementing VBO orphaning via `bufferData` re-allocation before `bufferSubData` calls, the CPU is never blocked waiting for the GPU to finish reading chunk geometry. By overriding `requestAnimationFrame` with a `MessageChannel` queue, the browser's native 60Hz V-Sync cap is bypassed, allowing uncapped framerates. Finally, dynamic frustum culling mathematically drops `drawElements` calls for terrain outside the camera's MVP matrix, drastically reducing wasted GPU compute.

OneCompiler Link: https://onecompiler.com/html/44sptusy4
