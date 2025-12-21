# Bug Report Log

Tracking all issues, from critical bugs to minor suggestions.

## Critical (App Breaking)

-   **[2024-05-21 12:30]**: `Uncaught TypeError: Cannot read properties of undefined (reading 'matrixWorld')` in `ProceduralBush.tsx` because `lod.update` tried to find a camera that wasn't in the scene. Fixed by passing camera explicitly.

## Warning (Unexpected Behavior)

-   ...

## Suggestion (Improvements)

-   ...