# Bolt's Journal - PixelForge Studio Performance Learnings

## 2026-07-26 - High-Resolution Canvas Garbage Collection & Selection Boundary Optimization
**Learning:** In canvas-based editors with high-resolution images (512x512, 1024x1024+), creating temporary typed arrays (`Float32Array(width * height)`) inside mousemove handlers and `ImageData` objects inside frame rendering callbacks causes massive GC pressure (10MB-30MB per event/frame). Furthermore, marching-ants selection animation iterating over the full `Set<number>` of selected pixels on every 40ms frame scales O(N) with area (1M+ iterations per frame for 1024x1024) rather than O(boundary).
**Action:** Lazy-allocate tool error buffers only when dithered blur/sharpen tools are active; reuse a cached `ImageData` instance for layer compositing; memoize boundary segments for selections so marching ants animation renders in O(boundary) time.

## 2026-07-26 - Selection Rotation Bounding Box & 32-bit Packed Palette Extraction
**Learning:** Iterating over `width * height` pixels during rotation transformations (`rotateSelectionPixels` and `rotateSelectionMask`) evaluates 4M+ loop iterations per frame on 2048x2048 canvases and executes slow Map lookups. Furthermore, extracting colors from high-res PNGs by calling `rgbToHex` per pixel creates up to 4 million temporary string objects.
**Action:** Calculate the transformed bounding box of the selection rotated around its pivot to constrain rotation loops from $O(W \times H)$ to $O(\text{Bounding Box Area})$ (a ~200x speedup). Use `Uint32Array` buffer views with 32-bit packed integers (`Set<number>`) in `extractColorsFromPNG` and `LayerThumbnail` to eliminate string object allocations on high-res images.
