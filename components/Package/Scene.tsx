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
import { createBalloons } from './ProceduralBalloon.tsx';
import { createWater } from './Water.tsx';
import { createLayoutMap, ZONE_COLORS } from './LayoutMap.tsx';
import type { PerformanceSettings } from '../Page/Welcome.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.tsx';

interface SceneProps {
  performanceSettings: PerformanceSettings;
}

const Scene: React.FC<SceneProps> = ({ performanceSettings }) => {
  const { theme, themeName } = useTheme();
  const breakpoint = useBreakpoint();
  
  const dayFactorRef = useRef(themeName === 'light' ? 1.0 : 0.0);
  const themeTargetRef = useRef(themeName);
  
  useEffect(() => {
    themeTargetRef.current = themeName;
  }, [themeName]);

  const updatablesRef = useRef<Array<(time: number, dayFactor: number, frustum: THREE.Frustum) => void>>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const firefliesRef = useRef<{ update: (time: number) => void; cleanup: () => void; } | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const frustumRef = useRef(new THREE.Frustum());
  const projScreenMatrixRef = useRef(new THREE.Matrix4());

  const isMobile = breakpoint === 'mobile';

  const initScene = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    sceneRef.current = scene;

    // --- CAMERA SETUP ---
    camera.position.set(0, isMobile ? 8 : 5, isMobile ? 18 : 12);

    // --- LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0); 
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 2.5);
    sunLight.castShadow = false;
    scene.add(sunLight);

    const moonLight = new THREE.DirectionalLight(0xCCDDFF, 0.0);
    moonLight.castShadow = false;
    scene.add(moonLight);
    
    scene.userData.sunLight = sunLight;
    scene.userData.moonLight = moonLight;

    // --- CELESTIAL BODIES ---
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xFFDD44, fog: false }) 
    );
    scene.add(sunMesh);

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4, 16, 16),
      new THREE.MeshStandardMaterial({ 
        color: 0xDDDDFF, 
        emissive: 0xEEEEFF,
        emissiveIntensity: 0.6,
        roughness: 0.8,
        fog: false
      })
    );
    scene.add(moonMesh);

    // --- CONTROLS ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3; 
    controlsRef.current = controls;

    // --- SCENE LAYOUT & OBJECT PLACEMENT ---
    const MAP_RES = 128;
    const SPREAD = 20.0;
    const layoutMap = createLayoutMap(MAP_RES, MAP_RES);

    const getLayoutZone = (x: number, z: number) => {
        const u = (x / SPREAD + 0.5);
        const v = (z / SPREAD + 0.5);
        if (u < 0 || u > 1 || v < 0 || v > 1) return null;

        const mapX = Math.floor(u * MAP_RES);
        const mapY = Math.floor(v * MAP_RES);
        const idx = (mapY * MAP_RES + mapX) * 4;
        
        const r = layoutMap.data[idx];
        const g = layoutMap.data[idx+1];
        const b = layoutMap.data[idx+2];

        for (const zone in ZONE_COLORS) {
            const color = ZONE_COLORS[zone as keyof typeof ZONE_COLORS];
            if (r === color[0] && g === color[1] && b === color[2]) {
                return zone;
            }
        }
        return null; // Return null for blended/unknown colors
    };
    
    const placeObjects = (
        count: number,
        targetZone: keyof typeof ZONE_COLORS,
        maxAttemptsPerObject = 1000,
        minDistance = 0
    ) => {
        const positions: { x: number; z: number }[] = [];
        let attempts = 0;
        const maxTotalAttempts = count * maxAttemptsPerObject;

        while (positions.length < count && attempts < maxTotalAttempts) {
            const x = (Math.random() - 0.5) * SPREAD;
            const z = (Math.random() - 0.5) * SPREAD;
            const zone = getLayoutZone(x, z);

            if (zone === targetZone) {
                let validPosition = true;
                if (minDistance > 0) {
                    for (const pos of positions) {
                        const dx = x - pos.x;
                        const dz = z - pos.z;
                        const distSq = dx * dx + dz * dz;
                        if (distSq < minDistance * minDistance) {
                            validPosition = false;
                            break;
                        }
                    }
                }

                if (validPosition) {
                    positions.push({ x, z });
                }
            }
            attempts++;
        }
        if (positions.length < count) {
            console.warn(`Could only place ${positions.length}/${count} objects in zone ${targetZone}`);
        }
        return positions;
    };
    
    const treeAndPinePositions = placeObjects(6, 'TREE', 1000, 5.0);
    const treePositions = treeAndPinePositions.slice(0, 3);
    const pinePositions = treeAndPinePositions.slice(3);
    const bushPositions = placeObjects(5, 'BUSH');
    const flowerPositions = placeObjects(5, 'FLOWER');
    const rockPositions = placeObjects(2, 'EMPTY');
    
    // --- OBJECT CREATION ---
    const sky = createSky(scene, theme);
    const shadowCasters = {
        rocks: rockPositions,
        trees: treeAndPinePositions,
        bushes: bushPositions
    };
    const ground = createGround(scene, theme, shadowCasters);
    const water = createWater(scene, theme);
    const rocks = createRocks(scene, theme, rockPositions);
    const trees = createTrees(scene, camera, theme, treePositions);
    const pines = createPineTrees(scene, camera, theme, pinePositions);
    const bushes = createBushes(scene, camera, theme, bushPositions);
    const flowers = createFlowers(scene, camera, theme, flowerPositions);
    const balloons = createBalloons(scene, camera, theme, isMobile ? 2 : 4);

    const obstacles = [
        ...rockPositions.map(p => ({...p, r: 2.5})),
        ...bushPositions.map(p => ({...p, r: 1.5})),
        ...treePositions.map(p => ({...p, r: 1.2})),
        ...pinePositions.map(p => ({...p, r: 1.2}))
    ];
    const grass = createGrass(scene, camera, theme, isMobile ? 10000 : 20000, obstacles, layoutMap);

    if (performanceSettings.effects) {
       const spread = 22;
       firefliesRef.current = createFireflies(scene, theme, isMobile ? 25 : 50, { width: spread, height: 4, depth: spread }, camera);
    }

    const sunPos = new THREE.Vector3();
    const moonPos = new THREE.Vector3();
    
    const dayHemiGround = new THREE.Color(0x99CC99); 
    const nightHemiGround = new THREE.Color(0x6a8a6c); 
    const dayHemiSky = new THREE.Color(0xA9DDF3); 
    const nightHemiSky = new THREE.Color(0x7b9cbe); 

    const envUpdate = (time: number, dayFactor: number, frustum: THREE.Frustum) => {
        const targetFactor = themeTargetRef.current === 'light' ? 1.0 : 0.0;
        const lerpSpeed = 0.02;
        dayFactorRef.current += (targetFactor - dayFactorRef.current) * lerpSpeed;
        const currentDayFactor = dayFactorRef.current;

        const orbitRadius = 60;
        const angle = (currentDayFactor - 0.5) * Math.PI; 
        
        sunPos.set(0, Math.sin(angle) * orbitRadius, Math.cos(angle) * orbitRadius);
        sunPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
        moonPos.copy(sunPos).negate();

        sunMesh.position.copy(sunPos);
        moonMesh.position.copy(moonPos);
        sunLight.position.copy(sunPos);
        sunLight.intensity = THREE.MathUtils.smoothstep(0.1, 0.7, currentDayFactor) * 2.5; 

        moonLight.position.copy(moonPos);
        const nightFactor = 1.0 - currentDayFactor;
        moonLight.intensity = THREE.MathUtils.smoothstep(0.4, 0.9, nightFactor) * 4.0;
        
        hemiLight.color.lerpColors(nightHemiSky, dayHemiSky, currentDayFactor);
        hemiLight.groundColor.lerpColors(nightHemiGround, dayHemiGround, currentDayFactor);
        hemiLight.intensity = THREE.MathUtils.lerp(1.0, 1.2, currentDayFactor);

        const dayFog = new THREE.Color(0xA9DDF3);
        const nightFog = new THREE.Color(0x3a4a5a); 
        const currentFogColor = new THREE.Color().lerpColors(nightFog, dayFog, currentDayFactor);
        
        const fogNear = 8;
        const fogFar = 22;

        if (scene.fog) {
            const fog = scene.fog as THREE.Fog;
            fog.color.copy(currentFogColor);
            fog.near = fogNear;
            fog.far = fogFar;
        } else {
            scene.fog = new THREE.Fog(currentFogColor, fogNear, fogFar);
        }
        
        scene.background = currentFogColor;

        sky.update(time, sunPos);
        water.update(time, currentDayFactor);
        if (firefliesRef.current) firefliesRef.current.update(time);
        bushes.update(time, frustum);
        trees.update(time, frustum);
        pines.update(time, frustum);
        rocks.update(time, frustum);
        ground.update(time);
        grass.update(time, frustum);
        flowers.update(time, frustum);
        balloons.update(time, currentDayFactor);
    };

    updatablesRef.current = [envUpdate];

    return () => {
      sky.cleanup(); water.cleanup(); bushes.cleanup(); trees.cleanup(); pines.cleanup();
      rocks.cleanup(); ground.cleanup(); grass.cleanup(); flowers.cleanup();
      balloons.cleanup();
      if (firefliesRef.current) firefliesRef.current.cleanup();
      firefliesRef.current = null;
      controls.dispose();
      updatablesRef.current = [];
      sceneRef.current = null;
    };
  }, [performanceSettings.shadows, performanceSettings.effects, isMobile]); 

  const pixelRatio = useMemo(() => {
    switch (performanceSettings.resolution) {
        case 'high': return window.devicePixelRatio;
        case 'balanced': return 1.0;
        case 'performance': return 0.75;
        case 'ultra': return 0.5;
        default: return 1;
    }
  }, [performanceSettings.resolution]);

  const onUpdate = useCallback((time: number, camera: THREE.Camera) => {
    if (controlsRef.current) {
        controlsRef.current.update();
    }
    
    projScreenMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);
    
    updatablesRef.current.forEach(fn => fn(time, dayFactorRef.current, frustumRef.current));
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