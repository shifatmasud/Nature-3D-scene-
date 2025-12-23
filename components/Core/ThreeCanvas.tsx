/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect } from 'react';
// FIX: Replaced named imports with a namespace import for Three.js to resolve module resolution errors.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

interface ThreeCanvasProps {
  onInit: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => (() => void) | void;
  onUpdate?: (time: number, camera: THREE.Camera) => void;
  className?: string;
  style?: React.CSSProperties;
  pixelRatio?: number;
  antiAliasing?: boolean;
  themeName?: 'light' | 'dark';
}

const ThreeCanvas: React.FC<ThreeCanvasProps> = ({ onInit, onUpdate, className, style, pixelRatio = 1, antiAliasing = true, themeName = 'dark' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- SETUP ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    
    // ADJUSTED FAR PLANE: 2000 is safer for depth buffer precision on mobile GPUs
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: antiAliasing, // Standard MSAA only if requested
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio); 
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    
    containerRef.current.appendChild(renderer.domElement);

    // --- POST PROCESSING ---
    if (!antiAliasing) {
      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        themeName === 'light' ? 0.02 : 0.35, 
        0.5,
        0.2
      );
      bloomPassRef.current = bloomPass;
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);

      composerRef.current = composer;
    } else {
      composerRef.current = null;
      bloomPassRef.current = null;
    }

    const cleanupUserLogic = onInit(scene, camera, renderer);

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composerRef.current) {
        composerRef.current.setSize(w, h);
      }
    };

    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const time = clock.getElapsedTime();
      if (onUpdate) {
        onUpdate(time, camera);
      }

      if (composerRef.current) {
        composerRef.current.render();
      } else {
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      
      if (cleanupUserLogic) cleanupUserLogic();
      
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
      }
      bloomPassRef.current = null;

      renderer.dispose();
      renderer.forceContextLoss(); 
      rendererRef.current = null;
      
      if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [onInit, antiAliasing]); // themeName removed from deps to prevent re-mounting and camera reset

  useEffect(() => {
    if (rendererRef.current) {
        rendererRef.current.setPixelRatio(pixelRatio);
        if (composerRef.current) {
            composerRef.current.setPixelRatio(pixelRatio);
        }
    }
  }, [pixelRatio]);

  useEffect(() => {
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = themeName === 'light' ? 0.02 : 0.35;
    }
  }, [themeName]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
};

export default ThreeCanvas;