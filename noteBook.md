# Developer Notebook

A log of all tasks, ideas, and progress for this project.

## To Do

-   [ ] Integrate Gemini API for a core feature.
-   [ ] Create a more complex page layout.
-   [ ] Add interactive 3D elements with Three.js.

## In Progress

-   ...

## Done

-   **[2024-05-21 13:45]**: Adjusted `ProceduralGrass` resolution to 128px and lowered alpha test threshold to 0.4. This creates a balance between sharp anime silhouettes and smooth, non-aliased rendering.
-   **[2024-05-21 13:00]**: Added `ProceduralGrass.tsx` with single-draw-call instancing, wind animation, and LOD system. Integrated into Scene.
-   **[2024-05-21 12:35]**: Fixed LOD crash in `ProceduralBush` by injecting camera dependency.
-   **[2024-05-21 12:00]**: Implemented `ProceduralBush` 3D scene. Added `ThreeCanvas` core component. Implemented custom shaders for wind and gradients. Updated `Welcome` page visuals.
-   **[2024-05-21 10:30]**: Implemented Tier 3 documentation files (`README.md`, `LLM.md`, `noteBook.md`, `bugReport.md`) as per system prompt.
-   **[2024-05-21 09:00]**: Initial project setup with React, Theme Provider, and responsive breakpoints.
