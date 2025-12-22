
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

// Define colors for different zones on the map. Using simple RGB values for easy matching.
export const ZONE_COLORS = {
    EMPTY: [0, 0, 0],       // Black: Nothing grows here (e.g., rocky patches)
    PATH: [255, 255, 255], // White: Paths, no foliage
    FLOWER: [255, 0, 0],   // Red: Flower patches
    GRASS: [0, 255, 0],     // Green: General grass areas
    BUSH: [0, 0, 255],     // Blue: Bush clusters
    TREE: [128, 0, 128],    // Purple: Trees and pines
};

// --- LOGIC ---
export const createLayoutMap = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // 1. Base Layer: Fill with lush grass to cover the whole land.
    ctx.fillStyle = `rgb(${ZONE_COLORS.GRASS.join(',')})`;
    ctx.fillRect(0, 0, width, height);

    const drawZone = (x: number, y: number, radius: number, color: number[]) => {
        ctx.fillStyle = `rgb(${color.join(',')})`;
        ctx.beginPath();
        ctx.arc(x * width, y * height, radius * width, 0, Math.PI * 2);
        ctx.fill();
    };

    // 2. Trees (TREE color) - 6 distinct zones for 3 normal & 3 pine trees.
    // They are placed far apart to prevent overlap and create a balanced scene.
    drawZone(0.2, 0.25, 0.05, ZONE_COLORS.TREE);  // Top-left
    drawZone(0.8, 0.3, 0.05, ZONE_COLORS.TREE);   // Top-right
    drawZone(0.75, 0.8, 0.05, ZONE_COLORS.TREE);  // Bottom-right
    drawZone(0.25, 0.75, 0.05, ZONE_COLORS.TREE); // Bottom-left
    drawZone(0.5, 0.85, 0.05, ZONE_COLORS.TREE);  // Bottom-center
    drawZone(0.5, 0.15, 0.05, ZONE_COLORS.TREE);  // Top-center

    // 3. Bushes (BUSH color) - 5 distinct zones.
    // Placed to complement the trees and fill open space.
    drawZone(0.35, 0.45, 0.04, ZONE_COLORS.BUSH);
    drawZone(0.7, 0.2, 0.04, ZONE_COLORS.BUSH);
    drawZone(0.15, 0.6, 0.04, ZONE_COLORS.BUSH);
    drawZone(0.8, 0.6, 0.04, ZONE_COLORS.BUSH);
    drawZone(0.6, 0.9, 0.04, ZONE_COLORS.BUSH);

    // 4. Flowers (FLOWER color) - 5 distinct zones.
    // These can overlap with grass and bushes in the final render.
    drawZone(0.35, 0.65, 0.04, ZONE_COLORS.FLOWER);
    drawZone(0.6, 0.45, 0.04, ZONE_COLORS.FLOWER);
    drawZone(0.18, 0.1, 0.04, ZONE_COLORS.FLOWER);
    drawZone(0.9, 0.5, 0.04, ZONE_COLORS.FLOWER);
    drawZone(0.3, 0.9, 0.04, ZONE_COLORS.FLOWER);

    // 5. Rocks (EMPTY color) - 2 zones at the center, drawn last to ensure they are clear.
    drawZone(0.5, 0.5, 0.04, ZONE_COLORS.EMPTY);
    drawZone(0.55, 0.52, 0.03, ZONE_COLORS.EMPTY);

    return ctx.getImageData(0, 0, width, height);
};
