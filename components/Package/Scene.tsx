
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useCallback, useEffect, useMemo } from 'react';
// FIX: Using named imports for Three.js classes and utilities to avoid namespace errors and ensure full type compatibility.
import { 
  Scene as ThreeScene, 
  PerspectiveCamera, 
  WebGLRenderer, 
  Frustum, 
  Matrix4, 
  HemisphereLight, 
  DirectionalLight, 
  Mesh, 
  SphereGeometry, 
  MeshBasicMaterial, 
  MeshStandardMaterial, 
  Vector3, 
  Color, 
  MathUtils, 
  Fog,
  Camera
} from 'three';
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
import { useBreakpoint, Breakpoint } from '../../hooks/useBreakpoint.tsx';

// --- SEEDED RANDOM HELPER ---
const mulberry32 = (a: number) => {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};

const FIXED_SEED = 12345;

interface SceneProps {
  performanceSettings: PerformanceSettings;
}

const getDeviceSettings = (breakpoint: Breakpoint) => {
  switch (breakpoint) {
    case 'mobile':
      return {
        cameraPos: { y: 8, z: 18 },
        grassPatchCount: 15,
        fireflyCount: 25,
        balloonCount: 2,
      };
    case 'tablet':
      return {
        cameraPos: { y: 6, z: 15 },
        grassPatchCount: 25,
        fireflyCount: 35,
        balloonCount: 3,
      };
    case 'desktop':
    default:
      return {
        cameraPos: { y: 5, z: 12 },
        grassPatchCount: 40,
        fireflyCount: 50,
        balloonCount: 4,
      };
  }
};

const Scene: React.FC<SceneProps> = ({ performanceSettings }) => {
  const { theme, themeName } = useTheme();
  const breakpoint = useBreakpoint();
  
  const dayFactorRef = useRef(themeName === 'light' ? 1.0 : 0.0);
  const themeTargetRef = useRef(themeName);
  
  useEffect(() => {
    themeTargetRef.current = themeName;
  }, [themeName]);

  const updatablesRef = useRef<Array<(time: number, dayFactor: number, frustum: Frustum) => void>>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const firefliesRef = useRef<{ update: (time: number) => void; cleanup: () => void; } | null>(null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const frustumRef = useRef(new Frustum());
  const projScreenMatrixRef = useRef(new Matrix4());
  
  const deviceSettings = useMemo(() => getDeviceSettings(breakpoint), [breakpoint]);

  // --- MEMOIZED LAYOUT ---
  const layout = useMemo(() => {
    const MAP_RES = 128;
    const SPREAD = 20.0;
    const layoutMap = createLayoutMap(MAP_RES, MAP_RES);
    const rng = mulberry32(FIXED_SEED);

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
            if (r === color[0] && g === color[1] && b === color[2]) return zone;
        }
        return null;
    };
    
    const placeObjects = (count: number, targetZone: keyof typeof ZONE_COLORS, minDistance = 0) => {
        const positions: { x: number; z: number }[] = [];
        let attempts = 0;
        while (positions.length < count && attempts < 10000) {
            const x = (rng() - 0.5) * SPREAD;
            const z = (rng() - 0.5) * SPREAD;
            if (getLayoutZone(x, z) === targetZone) {
                let valid = true;
                if (minDistance > 0) {
                    for (const pos of positions) {
                        const dx = x - pos.x, dz = z - pos.z;
                        if (dx * dx + dz * dz < minDistance * minDistance) { valid = false; break; }
                    }
                }
                if (valid) positions.push({ x, z });
            }
            attempts++;
        }
        return positions;
    };

    const treeAndPinePositions = placeObjects(5, 'TREE', 4.0);
    return {
        layoutMap,
        treePositions: treeAndPinePositions.slice(0, 2),
        pinePositions: treeAndPinePositions.slice(2),
        bushPositions: placeObjects(5, 'BUSH', 1.5),
        flowerPositions: placeObjects(8, 'FLOWER', 1.0),
        rockPositions: placeObjects(2, 'EMPTY', 2.0),
        grassPositions: placeObjects(deviceSettings.grassPatchCount, 'GRASS', 0.5),
        allTreePositions: treeAndPinePositions
    };
  }, [deviceSettings.grassPatchCount]);

  // Store performance settings in a ref to access within the reactive loop without re-triggering initScene
  const perfSettingsRef = useRef(performanceSettings);
  useEffect(() => {
    perfSettingsRef.current = performanceSettings;
  }, [performanceSettings]);

  // --- DYNAMIC FIREFLY TOGGLE ---
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current) return;

    if (performanceSettings.effects && !firefliesRef.current) {
        const spread = 22;
        firefliesRef.current = createFireflies(
            sceneRef.current, 
            theme, 
            deviceSettings.fireflyCount, 
            { width: spread, height: 4, depth: spread }, 
            cameraRef.current
        );
    } else if (!performanceSettings.effects && firefliesRef.current) {
        firefliesRef.current.cleanup();
        firefliesRef.current = null;
    }
  }, [performanceSettings.effects, deviceSettings.fireflyCount, theme]);

  const initScene = useCallback((scene: ThreeScene, camera: PerspectiveCamera, renderer: WebGLRenderer) => {
    sceneRef.current = scene;
    cameraRef.current = camera;

    camera.position.set(0, deviceSettings.cameraPos.y, deviceSettings.cameraPos.z);

    const hemiLight = new HemisphereLight(0xffffff, 0x444444, 1.0); 
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new DirectionalLight(0xFFFFFF, 2.5);
    scene.add(sunLight);

    const moonLight = new DirectionalLight(0xCCDDFF, 0.0);
    scene.add(moonLight);
    
    scene.userData.sunLight = sunLight;
    scene.userData.moonLight = moonLight;

    const sunMesh = new Mesh(
      new SphereGeometry(6, 16, 16),
      new MeshBasicMaterial({ color: 0xFFDD44, fog: false }) 
    );
    scene.add(sunMesh);

    const moonMesh = new Mesh(
      new SphereGeometry(4, 16, 16),
      new MeshStandardMaterial({ 
        color: 0xDDDDFF, 
        emissive: 0xEEEEFF,
        emissiveIntensity: 0.6,
        roughness: 0.8,
        fog: false
      })
    );
    scene.add(moonMesh);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3; 
    controlsRef.current = controls;

    // --- OBJECT CREATION USING MEMOIZED LAYOUT ---
    const sky = createSky(scene, theme);
    const shadowCasters = {
        rocks: layout.rockPositions,
        trees: layout.allTreePositions,
        bushes: layout.bushPositions
    };
    const ground = createGround(scene, theme, shadowCasters);
    const water = createWater(scene, theme);
    const rocks = createRocks(scene, theme, layout.rockPositions);
    const trees = createTrees(scene, camera, theme, layout.treePositions);
    const pines = createPineTrees(scene, camera, theme, layout.pinePositions);
    const bushes = createBushes(scene, camera, theme, layout.bushPositions);
    const flowers = createFlowers(scene, camera, theme, layout.flowerPositions);
    const balloons = createBalloons(scene, camera, theme, deviceSettings.balloonCount);

    const obstacles = [
        ...layout.rockPositions.map(p => ({...p, r: 2.5})),
        ...layout.bushPositions.map(p => ({...p, r: 1.5})),
        ...layout.treePositions.map(p => ({...p, r: 1.2})),
        ...layout.pinePositions.map(p => ({...p, r: 1.2}))
    ];
    const grass = createGrass(scene, camera, theme, layout.grassPositions, obstacles, layout.layoutMap);

    const sunPos = new Vector3();
    const moonPos = new Vector3();
    const dayHemiSky = new Color(0xA9DDF3); 
    const nightHemiSky = new Color(0x7b9cbe); 
    const dayHemiGround = new Color(0x99CC99); 
    const nightHemiGround = new Color(0x6a8a6c); 

    const envUpdate = (time: number, dayFactor: number, frustum: Frustum) => {
        const targetFactor = themeTargetRef.current === 'light' ? 1.0 : 0.0;
        dayFactorRef.current += (targetFactor - dayFactorRef.current) * 0.02;
        const currentDayFactor = dayFactorRef.current;

        const orbitRadius = 60;
        const angle = (currentDayFactor - 0.5) * Math.PI; 
        sunPos.set(0, Math.sin(angle) * orbitRadius, Math.cos(angle) * orbitRadius);
        sunPos.applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
        moonPos.copy(sunPos).negate();

        sunMesh.position.copy(sunPos);
        moonMesh.position.copy(moonPos);
        sunLight.position.copy(sunPos);
        sunLight.intensity = MathUtils.smoothstep(0.1, 0.7, currentDayFactor) * 2.5; 

        moonLight.position.copy(moonPos);
        const nightFactor = 1.0 - currentDayFactor;
        moonLight.intensity = MathUtils.smoothstep(0.4, 0.9, nightFactor) * 3.5;
        
        hemiLight.color.lerpColors(nightHemiSky, dayHemiSky, currentDayFactor);
        hemiLight.groundColor.lerpColors(nightHemiGround, dayHemiGround, currentDayFactor);
        hemiLight.intensity = MathUtils.lerp(1.0, 1.2, currentDayFactor);

        const dayFog = new Color(0xA9DDF3);
        const nightFog = new Color(0x455065); 
        const currentFogColor = new Color().lerpColors(nightFog, dayFog, currentDayFactor);
        
        if (scene.fog) {
            const fog = scene.fog as Fog;
            fog.color.copy(currentFogColor);
            fog.near = 15;
            fog.far = 60;
        } else {
            scene.fog = new Fog(currentFogColor, 15, 60);
        }
        scene.background = currentFogColor;

        // Pass camera position to sky update to handle skybox behavior correctly
        sky.update(time, sunPos, camera.position);
        water.update(time, currentDayFactor, perfSettingsRef.current.waterReflection);
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
      cameraRef.current = null;
    };
  }, [layout, deviceSettings.balloonCount]); 

  const pixelRatio = useMemo(() => {
    switch (performanceSettings.resolution) {
        case 'high': return window.devicePixelRatio;
        case 'balanced': return 1.0;
        case 'performance': return 0.75;
        case 'ultra': return 0.5;
        default: return 1;
    }
  }, [performanceSettings.resolution]);

  const onUpdate = useCallback((time: number, camera: Camera) => {
    if (controlsRef.current) controlsRef.current.update();
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

export default React.memo(Scene);
