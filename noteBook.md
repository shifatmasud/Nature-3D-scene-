
# Developer Notebook

A log of all tasks, ideas, and progress for this project.

## To Do

-   [ ] Integrate Gemini API for a core feature.
-   [ ] Create a more complex page layout.

## In Progress

-   ...

## Done

-   **[2024-05-22 11:45]**: Fully stopped star movement by anchoring sky mesh to camera position and switching to local coordinates for noise calculation. This eliminates parallax shimmering when zooming or translating the camera.
-   **[2024-05-22 11:30]**: Removed star twinkling animation for a more stable, serene night sky.
-   **[2024-05-22 11:15]**: Drastically slowed down star and cloud animations in `Sky.tsx` as requested.
-   **[2024-05-22 11:00]**: Enabled fireflies by default in the performance settings initial state.
-   **[2024-05-22 10:30]**: Implemented a performance settings panel to control resolution, shadows, and effects (fireflies), addressing FPS drop issues. Users can now dynamically adjust graphics for better performance.
-   **[2024-05-22 10:00]**: Adjusted `Scene.tsx` lighting and fog parameters to create a significantly lighter and more peaceful, anime-like night scene. This involved brightening `nightHemiGround`, `nightHemiSky`, increasing `moonLight.intensity`, boosting night `hemiLight.intensity`, and lightening `nightFog`.
-   **[2024-05-22 09:30]**: Implemented ultra performance optimizations for `Sky` and `ProceduralFirefly` components: reduced `SphereGeometry` segments for both, and added shader-based LOD (distance-based fading) to fireflies for performance. Fixed a camera dependency issue in `ProceduralFirefly.tsx`.
-   **[2024-05-21 13:45]**: Adjusted `ProceduralGrass` resolution to 128px and lowered alpha test threshold to 0.4. This creates a balance between sharp anime silhouettes and smooth, non-aliased rendering.
-   **[2024-05-21 13:00]**: Added `ProceduralGrass.tsx` with single-draw-call instancing, wind animation, and LOD system. Integrated into Scene.
-   **[2024-05-21 12:35]**: Fixed LOD crash in `ProceduralBush` by injecting camera dependency.
-   **[2024-05-21 12:00]**: Implemented `ProceduralBush` 3D scene. Added `ThreeCanvas` core component. Implemented custom shaders for wind and gradients. Updated `Welcome` page visuals.
-   **[2024-05-21 10:30]**: Implemented Tier 3 documentation files (`README.md`, `LLM.md`, `noteBook.md`, `bugReport.md`) as per system prompt.
-   **[2024-05-21 09:00]**: Initial project setup with React, Theme Provider, and responsive breakpoints.
