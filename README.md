
# React 18 Starter with Gemini API & Vite

This is a starter project for building modern, theme-aware React applications, now powered by Vite for a fast development experience and robust build process. It's set up with a modular structure, a powerful design system, and is ready for you to integrate the Gemini API.

## What's Inside? (ELI10 Version)

Imagine you're building with LEGOs. This project gives you a super organized box of special LEGO pieces to build an amazing app.

-   **`package.json`**: The list of all the LEGO sets (dependencies) our project needs to work. It also has instructions (scripts) on how to run or build our app.
-   **`vite.config.js`**: The rulebook for our super-fast LEGO builder, Vite.
-   **`index.html`**: The front door to our app. Vite uses this to start everything.
-   **`index.tsx`**: The main brain of the app. It tells React to start building our user interface.
-   **`Theme.tsx`**: The "master closet" for our app's style. It holds all the colors, fonts, and spacing rules for both light and dark modes. It's smart enough to adjust styles for phones, tablets, and desktops.
-   **`hooks/`**: A folder for special tools (custom hooks).
    -   `useBreakpoint.tsx`: A little helper that checks if you're on a phone, tablet, or big computer screen.
-   **`components/`**: The LEGO pieces themselves!
    -   **`Core/`**: The most basic, single-purpose pieces.
        -   `ThemeToggleButton.tsx`: A button to switch between light and dark themes.
        -   `ThreeCanvas.tsx`: The stage for our 3D world.
    -   **`Package/`**: More complex pieces made from Core components.
        -   `LayoutMap.tsx`: A special "drawing" that tells the scene where to place trees, grass, flowers, and paths, making the world look more designed.
        -   `Scene.tsx`: The entire 3D world, with trees, ground, sky, and lights. It reads the `LayoutMap` to arrange everything.
        -   `Water.tsx`: Creates the beautiful, reflective lake surrounding the island.
        -   `PerformanceSettings.tsx`: A pop-up menu to change graphics settings to make the app run faster.
        -   ... and all the procedural files for creating objects (`ProceduralBush.tsx`, `ProceduralTree.tsx`, etc.)
    -   **`Page/`**: Full pages made by combining smaller components.
        -   `Welcome.tsx`: The first screen you see, which holds the 3D scene and the UI buttons.
-   **`README.md`**: This file! Your friendly guide to the project.
-   **`LLM.md`**: Special instructions for AI helpers who might work on this code.
-   **`noteBook.md`**: A diary of all the tasks and features we're working on.
-   **`bugReport.md`**: A list of any pesky bugs we find and need to fix.

## Directory Tree

```
.
├── components/
│   ├── Core/
│   │   ├── ThemeToggleButton.tsx
│   │   └── ThreeCanvas.tsx
│   ├── Package/
│   │   ├── Ground.tsx
│   │   ├── LayoutMap.tsx
│   │   ├── PerformanceSettings.tsx
│   │   ├── ProceduralBalloon.tsx
│   │   ├── ProceduralBush.tsx
│   │   ├── ProceduralFirefly.tsx
│   │   ├── ProceduralFlower.tsx
│   │   ├── ProceduralGrass.tsx
│   │   ├── ProceduralPineTree.tsx
│   │   ├── ProceduralRock.tsx
│   │   ├── ProceduralTree.tsx
│   │   ├── Scene.tsx
│   │   ├── Sky.tsx
│   │   └── Water.tsx
│   └── Page/
│       └── Welcome.tsx
├── hooks/
│   └── useBreakpoint.tsx
├── README.md
├── LLM.md
├── noteBook.md
├── bugReport.md
├── Theme.tsx
├── package.json
├── vite.config.js
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── index.tsx
├── metadata.json
```

## How to Get Started

1.  **Install dependencies**: `npm install`
2.  **Run the development server**: `npm run dev`
3.  Open your browser to the URL provided by Vite.
4.  **To build for production**: `npm run build`. The output will be in the `dist/` folder, ready for deployment.

## Remix This Project

You can remix this project on AI Studio:
[Remix on AI Studio](https://ai.studio/apps/drive/18AwdRmobkEIWFVJrhaGEIdWYB8urUuh4)