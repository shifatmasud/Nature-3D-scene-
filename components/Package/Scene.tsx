/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ThreeCanvas from '../Core/ThreeCanvas.tsx';
import { useTheme } from '../../Theme.tsx';
import { createBushes } from './ProceduralBush.tsx';
import { createTrees } from './ProceduralTree.tsx';
import { createGround } from './Ground.tsx';
import { createGrass } from './ProceduralGrass.tsx';
import { createRocks } from './ProceduralRock.tsx';

const Scene = () => {
  const { theme } = useTheme();
  
  // Refs to store update functions so we can call them in the render loop
  const updatablesRef = useRef<Array<(time: number) => void>>([]);
  const controlsRef = useRef<OrbitControls | null>(null);

  const initScene = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    // Anime Sky: Soft Blue
    const skyColor = new THREE.Color(0x87CEEB);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor, 8, 35); // Pushed fog back slightly for trees
    
    // --- LIGHTING (Peaceful Anime) ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x87CEEB, 0.9); 
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFF9E6, 1.8);
    sunLight.position.set(8, 25, 8); // Higher sun for trees
    sunLight.castShadow = true;
    // PERFORMANCE: Reduced shadow map size for mid-low tier
    sunLight.shadow.mapSize.width = 512; 
    sunLight.shadow.mapSize.height = 512;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // --- CONTROLS ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3; 
    controls.minDistance = 2;
    controls.maxDistance = 30; // Increased max distance to view trees
    controlsRef.current = controls;

    // --- SCENE LAYOUT (Director) ---
    
    const spread = 18; 
    const minDistSq = 2.5 * 2.5; // generic minimum distance

    // 1. ROCKS (Priority 1: Large Obstacles)
    const rockCount = 6;
    const rockPositions: {x: number, z: number}[] = [];
    for(let i=0; i<rockCount; i++) {
        rockPositions.push({
            x: (Math.random() - 0.5) * spread,
            z: (Math.random() - 0.5) * spread
        });
    }

    // 2. TREES (Priority 2)
    const treeCount = 5;
    const treePositions: {x: number, z: number}[] = [];
    for(let i=0; i<treeCount; i++) {
        let x = 0, z = 0, valid = false, attempts = 0;
        while(!valid && attempts < 20) {
            x = (Math.random() - 0.5) * spread;
            z = (Math.random() - 0.5) * spread;
            valid = true;
            
            // Check Rocks (Large Buffer)
            for(const r of rockPositions) {
                const dx = x - r.x;
                const dz = z - r.z;
                if(dx*dx + dz*dz < 9) { // 3m buffer for rocks
                    valid = false; break;
                }
            }
            if (!valid) { attempts++; continue; }

            // Check Trees
            for(const t of treePositions) {
                const dx = x - t.x;
                const dz = z - t.z;
                if(dx*dx + dz*dz < 9) { // 3m buffer between trees
                    valid = false; break;
                }
            }
            attempts++;
        }
        if(valid) treePositions.push({x, z});
    }

    // 3. BUSHES (Priority 3: Filler)
    const bushCount = 10;
    const bushPositions: {x: number, z: number}[] = [];
    for(let i=0; i<bushCount; i++) {
        let x = 0, z = 0, valid = false, attempts = 0;
        while(!valid && attempts < 10) {
            x = (Math.random() - 0.5) * spread;
            z = (Math.random() - 0.5) * spread;
            valid = true;
            
            // Check Rocks
            for(const r of rockPositions) {
                const dx = x - r.x;
                const dz = z - r.z;
                if(dx*dx + dz*dz < 4) { // 2m buffer
                    valid = false; break;
                }
            }
            if(!valid) { attempts++; continue; }

            // Check Trees
            for(const t of treePositions) {
                const dx = x - t.x;
                const dz = z - t.z;
                if(dx*dx + dz*dz < 4) { // 2m buffer
                    valid = false; break;
                }
            }
            attempts++;
        }
        if(valid) bushPositions.push({x, z});
    }

    // --- OBJECT CREATION ---
    const ground = createGround(scene, theme);
    const rocks = createRocks(scene, theme, rockPositions);
    const trees = createTrees(scene, camera, theme, treePositions);
    const bushes = createBushes(scene, camera, theme, bushPositions);

    // Combine obstacles for grass "Smart Detection"
    // Rocks: Larger masking radius to keep grass off the stone
    // Bushes: Medium radius
    // Trees: EXCLUDED (Grass should grow under trees)
    const obstacles = [
        ...rockPositions.map(p => ({...p, r: 2.3})),
        ...bushPositions.map(p => ({...p, r: 1.4}))
    ];
    
    // Create Grass
    // 25 Chunks * 300 Blades = 7,500 Blades
    // Very lightweight configuration
    const grass = createGrass(scene, camera, theme, 25, obstacles);

    // Store update functions
    updatablesRef.current = [bushes.update, trees.update, rocks.update, ground.update, grass.update];

    // --- CLEANUP ---
    return () => {
      bushes.cleanup();
      trees.cleanup();
      rocks.cleanup();
      ground.cleanup();
      grass.cleanup();
      controls.dispose();
      updatablesRef.current = [];
    };
  }, [theme]);

  const onUpdate = useCallback((time: number) => {
    if (controlsRef.current) {
        controlsRef.current.update();
    }
    updatablesRef.current.forEach(fn => fn(time));
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
      <ThreeCanvas onInit={initScene} onUpdate={onUpdate} />
    </div>
  );
};

export default Scene;
