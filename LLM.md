
# LLM Instructions

Hello! You are an AI assistant helping to build this React application. Here are some simple instructions to follow.

## File Paths

-   `index.html`
-   `index.tsx`
-   `importmap.js`
-   `metadata.json`
-   `Theme.tsx`
-   `hooks/useBreakpoint.tsx`
-   `components/Core/ThemeToggleButton.tsx`
-   `components/Core/ThreeCanvas.tsx`
-   `components/Package/Ground.tsx`
-   `components/Package/PerformanceSettings.tsx`
-   `components/Package/ProceduralBush.tsx`
-   `components/Package/ProceduralFirefly.tsx`
-   `components/Package/ProceduralFlower.tsx`
-   `components/Package/ProceduralGrass.tsx`
-   `components/Package/ProceduralPineTree.tsx`
-   `components/Package/ProceduralRock.tsx`
-   `components/Package/ProceduralTree.tsx`
-   `components/Package/Scene.tsx`
-   `components/Package/Sky.tsx`
-   `components/Page/Welcome.tsx`
-   `README.md`
-   `LLM.md`
-   `noteBook.md`
-   `bugReport.md`

## Simple Rules (ELI10 Version)

1.  **Be a Tidy LEGO Builder**: Keep the code clean and organized. Follow the folder structure. Small, reusable pieces (`Core` components) are better than big, messy ones.
2.  **Use the Magic Style Closet (`Theme.tsx`)**: When you need a color, font size, or spacing, *always* get it from `theme` object provided by the `useTheme()` hook. Don't use your own made-up styles like `color: 'blue'` or `fontSize: '15px'`.
3.  **Animate Smoothly**: Use `framer-motion` for all animations. We like things to move gently and look premium.
4.  **Think Mobile First**: Make sure everything looks great on a phone first, then on a tablet, then on a desktop.
5.  **Speak Human**: When you add comments, explain things simply, like you're talking to a 10-year-old.
6.  **Document Your Work**: Before you finish, update `README.md` if you change the structure, `noteBook.md` with the task you completed, and `bugReport.md` if you found or fixed a bug.