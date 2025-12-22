

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ThreeCanvas from '../Core/ThreeCanvas.tsx';
import { useTheme } from '../../Theme.tsx';
import { createBushes } from './ProceduralBush.tsx';
import { createTrees } from './ProceduralTree.tsx';
import { createPineTrees } from './ProceduralPineTree.tsx';
import { createGround } from './Ground.tsx';
import { createGrass } from './ProceduralGrass.tsx';
import { createRocks } from './ProceduralRock.tsx';
import { createFlowers } from './ProceduralFlower.tsx';
import { createSky } from './Sky.tsx';
import { createFireflies } from './ProceduralFirefly.tsx';
import type { PerformanceSettings } from '../Page/Welcome.tsx';

interface SceneProps {
  performanceSettings: PerformanceSettings;
}

const Scene: React.FC<SceneProps> = ({ performanceSettings }) => {
  const { theme, themeName } = useTheme();
  
  const themeNameRef = useRef(themeName);
  
  useEffect(() => {
    themeNameRef.current = themeName;
  }, [themeName]);

  const updatablesRef = useRef<Array<(time: number, sunPos?: THREE.Vector3) => void>>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const firefliesRef = useRef<{ update: (time: number) => void; cleanup: () => void; } | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  const initScene = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    sceneRef.current = scene;

    // --- LIGHTING (Dynamic) ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0); 
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 2.5);
    sunLight.castShadow = performanceSettings.shadows;
    sunLight.shadow.mapSize.width = 512;
    sunLight.shadow.mapSize.height = 512;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);

    const moonLight = new THREE.DirectionalLight(0xCCDDFF, 0.0);
    moonLight.castShadow = performanceSettings.shadows;
    moonLight.shadow.mapSize.width = 512;
    moonLight.shadow.mapSize.height = 512;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 100;
    moonLight.shadow.camera.left = -30;
    moonLight.shadow.camera.right = 30;
    moonLight.shadow.camera.top = 30;
    moonLight.shadow.camera.bottom = -30;
    moonLight.shadow.bias = -0.001;
    scene.add(moonLight);
    
    // Attach lights to ref for later access
    scene.userData.sunLight = sunLight;
    scene.userData.moonLight = moonLight;


    // --- CELESTIAL BODIES ---
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xFFDD44 }) 
    );
    scene.add(sunMesh);

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4, 32, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xDDDDFF, 
        emissive: 0x333377,
        roughness: 0.8 
      })
    );
    scene.add(moonMesh);

    // --- CONTROLS ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3; 
    controls.minDistance = 5;
    controls.maxDistance = 45; 
    controlsRef.current = controls;

    // --- SCENE LAYOUT ---
    const spread = 22; 
    
    const rockCount = 3;
    const rockPositions: {x: number, z: number}[] = [];
    for(let i=0; i<rockCount; i++) {
        rockPositions.push({
            x: (Math.random() - 0.5) * spread,
            z: (Math.random() - 0.5) * spread
        });
    }

    const treeCount = 3;
    const treePositions: {x: number, z: number}[] = [];
    for(let i=0; i<treeCount; i++) {
        let x = 0, z = 0, valid = false, attempts = 0;
        while(!valid && attempts < 20) {
            x = (Math.random() - 0.5) * spread;
            z = (Math.random() - 0.5) * spread;
            valid = true;
            for(const r of rockPositions) {
                const dx = x - r.x; const dz = z - r.z;
                if(dx*dx + dz*dz < 9) { valid = false; break; }
            }
            if (!valid) { attempts++; continue; }
            for(const t of treePositions) {
                const dx = x - t.x; const dz = z - t.z;
                if(dx*dx + dz*dz < 9) { valid = false; break; }
            }
            attempts++;
        }
        if(valid) treePositions.push({x, z});
    }

    const pineCount = 3;
    const pinePositions: {x: number, z: number}[] = [];
    for(let i=0; i<pineCount; i++) {
        let x = 0, z = 0, valid = false, attempts = 0;
        while(!valid && attempts < 20) {
            x = (Math.random() - 0.5) * spread;
            z = (Math.random() - 0.5) * spread;
            valid = true;
            for(const r of rockPositions) {
                const dx = x - r.x; const dz = z - r.z;
                if(dx*dx + dz*dz < 9) { valid = false; break; }
            }
            if (!valid) { attempts++; continue; }
            for(const t of treePositions) {
                const dx = x - t.x; const dz = z - t.z;
                if(dx*dx + dz*dz < 9) { valid = false; break; }
            }
            if (!valid) { attempts++; continue; }
             for(const p of pinePositions) {
                const dx = x - p.x; const dz = z - p.z;
                if(dx*dx + dz*dz < 9) { valid = false; break; }
            }
            attempts++;
        }
        if(valid) pinePositions.push({x, z});
    }

    const bushCount = 5;
    const bushPositions: {x: number, z: number}[] = [];
    for(let i=0; i<bushCount; i++) {
        let x = 0, z = 0, valid = false, attempts = 0;
        while(!valid && attempts < 10) {
            x = (Math.random() - 0.5) * spread;
            z = (Math.random() - 0.5) * spread;
            valid = true;
            for(const r of rockPositions) {
                const dx = x - r.x; const dz = z - r.z;
                if(dx*dx + dz*dz < 4) { valid = false; break; }
            }
            if(!valid) { attempts++; continue; }
            for(const t of treePositions) {
                const dx = x - t.x; const dz = z - t.z;
                if(dx*dx + dz*dz < 4) { valid = false; break; }
            }
            if(!valid) { attempts++; continue; }
             for(const p of pinePositions) {
                const dx = x - p.x; const dz = z - p.z;
                if(dx*dx + dz*dz < 4) { valid = false; break; }
            }
            if(!valid) { attempts++; continue; }
            attempts++;
        }
        if(valid) bushPositions.push({x, z});
    }

    const flowerCount = 100;
    const flowerPositions: {x: number, z: number}[] = [];
    for(let i=0; i<flowerCount; i++) {
        let x = 0, z = 0, valid = false, attempts = 0;
        while(!valid && attempts < 10) {
            x = (Math.random() - 0.5) * spread;
            z = (Math.random() - 0.5) * spread;
            valid = true;
            for(const r of rockPositions) {
                const dx = x - r.x; const dz = z - r.z;
                if(dx*dx + dz*dz < 6.25) { valid = false; break; }
            }
            if(!valid) { attempts++; continue; }
            for(const t of treePositions) {
                const dx = x - t.x; const dz = z - t.z;
                if(dx*dx + dz*dz < 2.25) { valid = false; break; }
            }
            if(!valid) { attempts++; continue; }
             for(const p of pinePositions) {
                const dx = x - p.x; const dz = z - p.z;
                if(dx*dx + dz*dz < 2.25) { valid = false; break; }
            }
            if(!valid) { attempts++; continue; }
            attempts++;
        }
        if(valid) flowerPositions.push({x, z});
    }

    // --- OBJECT CREATION ---
    const sky = createSky(scene, theme);
    const ground = createGround(scene, theme);
    const rocks = createRocks(scene, theme, rockPositions);
    const trees = createTrees(scene, camera, theme, treePositions);
    const pines = createPineTrees(scene, camera, theme, pinePositions);
    const bushes = createBushes(scene, camera, theme, bushPositions);
    const flowers = createFlowers(scene, theme, flowerPositions);

    const obstacles = [
        ...rockPositions.map(p => ({...p, r: 2.3})),
        ...bushPositions.map(p => ({...p, r: 1.4}))
    ];
    const grass = createGrass(scene, camera, theme, 30, obstacles);

    if (performanceSettings.effects) {
       firefliesRef.current = createFireflies(scene, theme, 50, { width: spread, height: 4, depth: spread }, camera);
    }

    // Store update functions
    const sunPos = new THREE.Vector3();
    const moonPos = new THREE.Vector3();
    
    const dayHemiGround = new THREE.Color(0x99CC99); 
    const nightHemiGround = new THREE.Color(0x6a8a6c); 
    const dayHemiSky = new THREE.Color(0xA9DDF3); 
    const nightHemiSky = new THREE.Color(0x7b9cbe); 

    let currentDayFactor = themeNameRef.current === 'light' ? 1.0 : 0.0;

    const envUpdate = (time: number) => {
        const isLightMode = themeNameRef.current === 'light';
        const targetFactor = isLightMode ? 1.0 : 0.0;
        
        const lerpSpeed = 0.02;
        currentDayFactor += (targetFactor - currentDayFactor) * lerpSpeed;

        const orbitRadius = 60;
        const angle = (currentDayFactor - 0.5) * Math.PI; 
        
        sunPos.set(0, Math.sin(angle) * orbitRadius, Math.cos(angle) * orbitRadius);
        sunPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
        moonPos.copy(sunPos).negate();

        sunMesh.position.copy(sunPos);
        moonMesh.position.copy(moonPos);
        sunMesh.lookAt(0,0,0);
        moonMesh.lookAt(0,0,0);

        sunLight.position.copy(sunPos);
        sunLight.intensity = THREE.MathUtils.smoothstep(0.1, 0.7, currentDayFactor) * 2.5; 

        moonLight.position.copy(moonPos);
        const nightFactor = 1.0 - currentDayFactor;
        moonLight.intensity = THREE.MathUtils.smoothstep(0.4, 0.9, nightFactor) * 4.0;
        
        hemiLight.color.lerpColors(nightHemiSky, dayHemiSky, currentDayFactor);
        hemiLight.groundColor.lerpColors(nightHemiGround, dayHemiGround, currentDayFactor);
        hemiLight.intensity = THREE.MathUtils.lerp(1.0, 1.2, currentDayFactor);

        const dayFog = new THREE.Color(0x87CEEB);
        const nightFog = new THREE.Color(0x7a8a9a); 
        const currentFogColor = new THREE.Color().lerpColors(nightFog, dayFog, currentDayFactor);
        
        if (scene.fog) {
            (scene.fog as THREE.Fog).color.copy(currentFogColor);
        } else {
            // UPDATED FOG: Start closer (15) and be denser (end at 80)
            scene.fog = new THREE.Fog(currentFogColor, 15, 80);
        }
        
        scene.background = currentFogColor;

        sky.update(time, sunPos);
        if (firefliesRef.current) firefliesRef.current.update(time);
        bushes.update(time);
        trees.update(time);
        pines.update(time);
        rocks.update(time);
        ground.update(time);
        grass.update(time);
        flowers.update(time);
    };

    updatablesRef.current = [envUpdate];

    return () => {
      sky.cleanup();
      bushes.cleanup();
      trees.cleanup();
      pines.cleanup();
      rocks.cleanup();
      ground.cleanup();
      grass.cleanup();
      flowers.cleanup();
      if (firefliesRef.current) firefliesRef.current.cleanup();
      firefliesRef.current = null;
      controls.dispose();
      updatablesRef.current = [];
      sceneRef.current = null;
    };
  }, [theme, performanceSettings.shadows, performanceSettings.effects]); 

  // Effect to update shadows
  useEffect(() => {
      const scene = sceneRef.current;
      if(scene?.userData?.sunLight && scene?.userData?.moonLight) {
          scene.userData.sunLight.castShadow = performanceSettings.shadows;
          scene.userData.moonLight.castShadow = performanceSettings.shadows;
      }
  }, [performanceSettings.shadows]);

  // Effect to update fireflies
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (performanceSettings.effects && !firefliesRef.current) {
        // Find camera in scene children to pass to createFireflies
        const camera = scene.children.find(c => c instanceof THREE.PerspectiveCamera) as THREE.PerspectiveCamera;
        if (camera) {
             firefliesRef.current = createFireflies(scene, theme, 50, { width: 22, height: 4, depth: 22 }, camera);
        }
    } else if (!performanceSettings.effects && firefliesRef.current) {
        firefliesRef.current.cleanup();
        firefliesRef.current = null;
    }
  }, [performanceSettings.effects, theme]);


  const pixelRatio = useMemo(() => {
    switch (performanceSettings.resolution) {
        case 'high': return window.devicePixelRatio;
        case 'balanced': return 1;
        case 'performance': return 0.75;
        case 'ultra': return 0.5;
        default: return 1;
    }
  }, [performanceSettings.resolution]);

  const onUpdate = useCallback((time: number) => {
    if (controlsRef.current) {
        controlsRef.current.update();
    }
    updatablesRef.current.forEach(fn => fn(time));
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
      <ThreeCanvas 
        onInit={initScene} 
        onUpdate={onUpdate} 
        pixelRatio={pixelRatio} 
        antiAliasing={performanceSettings.antiAliasing}
        themeName={themeName}
      />
    </div>
  );
};

export default Scene;