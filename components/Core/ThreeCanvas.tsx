/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ThreeCanvasProps {
  onInit: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => (() => void) | void;
  className?: string;
  style?: React.CSSProperties;
}

const ThreeCanvas: React.FC<ThreeCanvasProps> = ({ onInit, className, style }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- SETUP ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    // Note: Background color is now handled by the parent in onInit or via ref updates

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    containerRef.current.appendChild(renderer.domElement);

    // --- USER LOGIC INJECTION ---
    const cleanupUserLogic = onInit(scene, camera, renderer);

    // --- RESIZE ---
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // --- LOOP ---
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // --- CLEANUP ---
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      
      if (cleanupUserLogic) cleanupUserLogic();
      
      // CRITICAL: Force context loss to prevents "Too many active WebGL contexts" error
      renderer.dispose();
      renderer.forceContextLoss(); 
      
      if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [onInit]); // Removed theme dependency to prevent recreation on theme change

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
};

export default ThreeCanvas;