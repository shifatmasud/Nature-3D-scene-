
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
import type { PerformanceSettings } from '../Page/Welcome.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.tsx';

interface SceneProps {
  performanceSettings: PerformanceSettings;
}

const Scene: React.FC<SceneProps> = ({ performanceSettings }) => {
  const { theme, themeName } = useTheme();
  const breakpoint = useBreakpoint();
  
  // Ref for the current day factor to allow smooth interpolation across frames
  const dayFactorRef = useRef(themeName === 'light' ? 1.0 : 0.0);
  const themeTargetRef = useRef(themeName);
  
  useEffect(() => {
    themeTargetRef.current = themeName;
  }, [themeName]);

  const updatablesRef = useRef<Array<(time: number, dayFactor: number) => void>>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const firefliesRef = useRef<{ update: (time: number) => void; cleanup: () => void; } | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  const isMobile = breakpoint === 'mobile';

  // initScene should only depend on things that fundamentally change the scene structure
  // like performance settings or mobile vs desktop layout. 
  // themeName is NOT in the deps to prevent full re-init (and camera reset)
  const initScene = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    sceneRef.current = scene;

    // --- CAMERA SETUP ---
    camera.position.set(0, isMobile ? 8 : 5, isMobile ? 18 : 12);

    // --- LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0); 
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 2.5);
    sunLight.castShadow = performanceSettings.shadows;
    sunLight.shadow.mapSize.width = isMobile ? 256 : 512;
    sunLight.shadow.mapSize.height = isMobile ? 256 : 512;
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
    moonLight.shadow.mapSize.width = isMobile ? 256 : 512;
    moonLight.shadow.mapSize.height = isMobile ? 256 : 512;
    scene.add(moonLight);
    
    scene.userData.sunLight = sunLight;
    scene.userData.moonLight = moonLight;

    // --- CELESTIAL BODIES ---
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      // Sun Mesh ignoring fog to stay clear during day
      new THREE.MeshBasicMaterial({ color: 0xFFDD44, fog: false }) 
    );
    scene.add(sunMesh);

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4, 16, 16),
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
    controls.minDistance = isMobile ? 8 : 5;
    controls.maxDistance = isMobile ? 60 : 45; 
    controlsRef.current = controls;

    // --- SCENE LAYOUT ---
    const spread = 22; 
    const rockPositions = [{x: -5, z: 4}, {x: 6, z: -3}, {x: 2, z: 8}];
    const treePositions = [{x: -8, z: -8}, {x: 8, z: 2}, {x: 0, z: -10}];
    const pinePositions = [{x: 10, z: -8}, {x: -9, z: 5}, {x: 2, z: -6}];
    const bushPositions = [{x: 4, z: 4}, {x: -4, z: -2}, {x: 1, z: 5}, {x: -7, z: 0}];
    const flowerPositions = Array.from({length: isMobile ? 40 : 100}, () => ({
        x: (Math.random() - 0.5) * spread,
        z: (Math.random() - 0.5) * spread
    }));

    // --- OBJECT CREATION ---
    const sky = createSky(scene, theme);
    const ground = createGround(scene, theme);
    const rocks = createRocks(scene, theme, rockPositions);
    const trees = createTrees(scene, camera, theme, treePositions);
    const pines = createPineTrees(scene, camera, theme, pinePositions);
    const bushes = createBushes(scene, camera, theme, bushPositions);
    const flowers = createFlowers(scene, theme, flowerPositions);
    const balloons = createBalloons(scene, theme, isMobile ? 2 : 4);

    const obstacles = [
        ...rockPositions.map(p => ({...p, r: 2.3})),
        ...bushPositions.map(p => ({...p, r: 1.4}))
    ];
    const grass = createGrass(scene, camera, theme, isMobile ? 15 : 30, obstacles);

    if (performanceSettings.effects) {
       firefliesRef.current = createFireflies(scene, theme, isMobile ? 25 : 50, { width: spread, height: 4, depth: spread }, camera);
    }

    const sunPos = new THREE.Vector3();
    const moonPos = new THREE.Vector3();
    
    const dayHemiGround = new THREE.Color(0x99CC99); 
    const nightHemiGround = new THREE.Color(0x6a8a6c); 
    const dayHemiSky = new THREE.Color(0xA9DDF3); 
    const nightHemiSky = new THREE.Color(0x7b9cbe); 

    const envUpdate = (time: number) => {
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

        const dayFog = new THREE.Color(0x87CEEB);
        const nightFog = new THREE.Color(0x7a8a9a); 
        const currentFogColor = new THREE.Color().lerpColors(nightFog, dayFog, currentDayFactor);
        
        if (scene.fog) {
            (scene.fog as THREE.Fog).color.copy(currentFogColor);
        } else {
            scene.fog = new THREE.Fog(currentFogColor, isMobile ? 10 : 15, isMobile ? 60 : 80);
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
        balloons.update(time, currentDayFactor);
    };

    updatablesRef.current = [envUpdate];

    return () => {
      sky.cleanup(); bushes.cleanup(); trees.cleanup(); pines.cleanup();
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

  const onUpdate = useCallback((time: number) => {
    if (controlsRef.current) {
        controlsRef.current.update();
    }
    updatablesRef.current.forEach(fn => fn(time, dayFactorRef.current));
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
