/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import ThreeCanvas from '../Core/ThreeCanvas.tsx';
import { useTheme } from '../../Theme.tsx';

// --- TEXTURE GENERATION (B/W ALPHA MAP - FULL CANVAS CLUSTER) ---

const createDenseClusterTexture = () => {
  const size = 512; // Simplified texture size
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, size, size);

  // Helper: Draw a realistic leaf (Solid White for Shape, Sharp Alpha)
  const drawLeaf = (x: number, y: number, len: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    
    const wid = len * 0.45; 
    
    // NOTE: Shadow blur removed to ensure alpha map has no gradients (sharp edges)
    
    // Leaf Shape
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid, len * 0.3, -wid, len * 0.7, 0, len);
    ctx.bezierCurveTo(wid, len * 0.7, wid, len * 0.3, 0, 0);
    ctx.closePath();
    
    // Solid White Fill (Leaves have no internal gradients, pure shape)
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.restore();
  };

  // Draw 30 leaves across the WHOLE texture
  const cx = size / 2;
  const cy = size / 2;
  const count = 30;

  // Draw from back to front (larger leaves in back, smaller in front)
  // Layer 1: Background "filler" leaves
  for(let i=0; i<12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.25);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    // Reduced length multiplier from 0.15 to 0.08
    const len = (size * 0.08) * (0.8 + Math.random() * 0.4);
    // Point roughly outward
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*0.5 - 0.25));
  }

  // Layer 2: Main body
  for(let i=0; i<12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.15); // Closer to center
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    // Reduced length multiplier from 0.12 to 0.06
    const len = (size * 0.06) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*1.0 - 0.5));
  }

  // Layer 3: Center details
  for(let i=0; i<6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.05);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    // Reduced length multiplier from 0.10 to 0.05
    const len = (size * 0.05) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, Math.random() * Math.PI * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; 
  return tex;
};

const ProceduralBush = () => {
  const { theme } = useTheme();
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme.Color.Base.Surface[1]);
    }
  }, [theme]);

  const initScene = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    
    sceneRef.current = scene;
    scene.background = new THREE.Color(theme.Color.Base.Surface[1]);
    
    // Enable soft shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- LIGHTING ---
    
    // 1. Hemisphere Light (Soft global fill - Sky vs Ground)
    // Replaces AmbientLight to create more diffused, natural shadows that aren't too dark
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // 2. Key Light (Sun)
    const sunLight = new THREE.DirectionalLight(0xfff0dd, 2.5);
    sunLight.position.set(5, 12, 5); // Adjusted for better angle
    sunLight.castShadow = true;
    
    sunLight.shadow.mapSize.width = 1024; 
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.normalBias = 0.05; 
    
    // Increased radius significantly (3 -> 10) for "Soft Diffused" look
    sunLight.shadow.radius = 10; 
    
    const d = 4; 
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // --- GEOMETRY ---
    // Small base geometry (Reduced size to 0.3, Detail to 1)
    const baseGeo = new THREE.IcosahedronGeometry(0.3, 1);
    const posAttribute = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < posAttribute.count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        // Small, tight bush
        vertex.normalize().multiplyScalar(0.5 + Math.random() * 0.3); 
        posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    baseGeo.computeVertexNormals();
    const baseMesh = new THREE.Mesh(baseGeo);
    const sampler = new MeshSurfaceSampler(baseMesh).build();

    // --- MATERIAL ---
    const clusterTexture = createDenseClusterTexture();
    
    const material = new THREE.MeshStandardMaterial({
      map: clusterTexture,
      alphaTest: 0.5, 
      side: THREE.DoubleSide,
      roughness: 0.9, 
      metalness: 0.0,
      flatShading: false,
    });

    const customUniforms = { uTime: { value: 0 } };

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = customUniforms.uTime;

      shader.vertexShader = `
        uniform float uTime;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
        
        // Random Bend
        vec2 centeredUv = uv - 0.5;
        float bendStrength = 0.5 + id * 1.5; 
        transformed.z -= (dot(centeredUv, centeredUv) * bendStrength);
        
        // Gentle Wind
        vec4 wPos = instanceMatrix * vec4(transformed, 1.0);
        float sway = sin(uTime * 0.3 + wPos.x * 0.4 + wPos.y * 0.2) * 0.15; 
        float flutter = sin(uTime * 1.2 + wPos.x * 3.0) * 0.03 * uv.y;
        
        transformed.x += sway + flutter;
        transformed.z += sway * 0.5;
        transformed.y += sin(uTime * 0.5 + wPos.z)*0.05 * uv.y;
        `
      );

      // --- FRAGMENT SHADER: Plane Gradient ---
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        
        // Apply vertical gradient to the plane geometry (Stem=Darker, Tip=Lighter)
        // vMapUv is provided by Three.js when a map is used.
        float planeGradient = mix(0.4, 1.1, vMapUv.y); 
        diffuseColor.rgb *= planeGradient;
        `
      );
    };

    // --- INSTANCING ---
    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    // Simplified plane geometry to 2x2 segments
    const planeGeo = new THREE.PlaneGeometry(1, 1, 2, 2);

    const createInstancedMesh = (count: number, scaleMod: number) => {
        const mesh = new THREE.InstancedMesh(planeGeo, material, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        for (let i = 0; i < count; i++) {
            const _pos = new THREE.Vector3();
            const _norm = new THREE.Vector3();
            sampler.sample(_pos, _norm);
            
            _pos.add(_norm.multiplyScalar(0.2));
            
            dummy.position.copy(_pos);
            dummy.lookAt(_pos.clone().add(_norm));
            dummy.rotateZ(Math.random() * Math.PI * 2);

            const s = (0.7 + Math.random() * 0.5) * scaleMod; 
            dummy.scale.set(s, s, s);
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            
            const v = Math.random();
            if(v > 0.8) tempColor.setHex(0xA6C468); 
            else if(v > 0.5) tempColor.setHex(0x5E8C31); 
            else tempColor.setHex(0x2E4F23); 
            mesh.setColorAt(i, tempColor);
        }
        
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        
        return mesh;
    };

    const lod = new THREE.LOD();
    
    // Level 0: High Detail (200 instances)
    lod.addLevel(createInstancedMesh(200, 1.4), 0);
    
    // Level 1: Medium Detail
    lod.addLevel(createInstancedMesh(50, 1.8), 15);
    
    // Level 2: Low Detail
    lod.addLevel(createInstancedMesh(20, 2.5), 30);
    
    lod.position.y = 0;
    scene.add(lod);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.minDistance = 2;
    controls.maxDistance = 25;
    
    const clock = new THREE.Clock();
    let frameId: number;
    const animate = () => {
        const t = clock.getElapsedTime();
        customUniforms.uTime.value = t; 
        controls.update();
        frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
        cancelAnimationFrame(frameId);
        controls.dispose();
        planeGeo.dispose();
        baseGeo.dispose();
        clusterTexture.dispose();
        material.dispose();
        sceneRef.current = null;
    };

  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
      <ThreeCanvas onInit={initScene} />
    </div>
  );
};

export default ProceduralBush;