/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { getGroundElevation } from './Ground.tsx';

// --- HELPERS ---

const mulberry32 = (a: number) => {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};

const createDenseClusterTexture = () => {
  const size = 32; // OPTIMIZED: Reduced texture size to 32px
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, size, size);

  const drawLeaf = (x: number, y: number, len: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const wid = len * 0.45; 
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid, len * 0.3, -wid, len * 0.7, 0, len);
    ctx.bezierCurveTo(wid, len * 0.7, wid, len * 0.3, 0, 0);
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();
  };

  const cx = size / 2;
  const cy = size / 2;

  // Layer 1: Background
  for(let i=0; i<20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.25);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.08) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*0.5 - 0.25));
  }

  // Layer 2: Main body
  for(let i=0; i<20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.15); 
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.06) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*1.0 - 0.5));
  }

  // Layer 3: Center details
  for(let i=0; i<10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.05);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.05) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, Math.random() * Math.PI * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; 
  return tex;
};

// --- LOGIC ---

export const createBushes = (
    scene: THREE.Scene, 
    camera: THREE.Camera, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const seed = 123456; 
    const rng = mulberry32(seed);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { uTime: { value: 0 } };
        const count = positions.length;

        const baseRadius = 0.3; 
        const baseGeo = new THREE.IcosahedronGeometry(baseRadius, 0);
        const sampler = new MeshSurfaceSampler(new THREE.Mesh(baseGeo)).build();
        const planeGeo = new THREE.PlaneGeometry(1, 1, 1, 1);

        const clusterTexture = createDenseClusterTexture();
        const material = new THREE.MeshStandardMaterial({
          map: clusterTexture,
          alphaTest: 0.5, 
          side: THREE.DoubleSide,
          roughness: 0.9, 
          metalness: 0.0,
          flatShading: false,
        });

        material.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = customUniforms.uTime;

          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            uniform float uTime;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            `
          );

          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
            float isZFacing = step(0.9, abs(normal.z));
            float dist = length(uv - 0.5);
            transformed.z -= dist * dist * 1.0 * isZFacing;
            
            float windPhase = uTime * 0.8 + instanceMatrix[3].x * 0.5;
            float windSway = sin(windPhase);
            float windFlutter = sin(windPhase * 2.5 + id * 5.0) * 0.15;
            float windOffset = (windSway + windFlutter) * uv.y * 0.05;
            
            transformed.x += windOffset; 
            transformed.z += windOffset * 0.3; 
            transformed.y += sin(windPhase * 1.5) * uv.y * 0.02; 
            `
          );
          
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>
            float planeGradient = mix(0.5, 1.1, vMapUv.y); 
            diffuseColor.rgb *= planeGradient;
            `
          );
        };

        const leavesPerBush = 100; 
        const totalInstances = count * leavesPerBush;
        
        const instancedMesh = new THREE.InstancedMesh(planeGeo, material, totalInstances);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = false; 

        const dummy = new THREE.Object3D();
        const tempColor = new THREE.Color();
        const upVector = new THREE.Vector3(0, 1, 0);
        const _pos = new THREE.Vector3();
        const _norm = new THREE.Vector3();

        let instanceIndex = 0;

        for (let i = 0; i < count; i++) {
            // UPDATED: Bigger bushes
            const structureScale = 4.0 + Math.random() * 3.0; 
            const visualRadius = baseRadius * structureScale;
            
            const p = positions[i];
            const displacementScale = 0.3;
            const groundHeight = getGroundElevation(p.x, p.z) * displacementScale;
            const baseHeight = -1.5;
            
            // UPDATED: Less sinking to keep them higher up
            const sinkAmount = 0.05;
            const centerY = baseHeight + groundHeight + visualRadius - sinkAmount;
            const center = new THREE.Vector3(p.x, centerY, p.z);

            for (let j = 0; j < leavesPerBush; j++) {
                sampler.sample(_pos, _norm);
                const leafOffset = _pos.clone().normalize().multiplyScalar(visualRadius);
                const noise = (Math.random() - 0.5) * 0.4;
                leafOffset.add(_norm.clone().multiplyScalar(noise));
                const leafPos = center.clone().add(leafOffset);
                
                _norm.lerp(upVector, 0.5).normalize();
                dummy.position.copy(leafPos);
                dummy.lookAt(leafPos.clone().add(_norm));
                dummy.rotateZ(Math.random() * Math.PI * 2);

                // UPDATED: Bigger leaves to match bush scale
                const leafScaleBase = 2.5; 
                const s = (0.8 + Math.random() * 0.6) * leafScaleBase; 
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                
                instancedMesh.setMatrixAt(instanceIndex, dummy.matrix);

                // SYNCHRONIZED PALETTE
                const v = Math.random();
                if(v > 0.7) tempColor.setHex(0xB2D8B2); 
                else if(v > 0.3) tempColor.setHex(0x88C488); 
                else tempColor.setHex(0x66A566);
                
                if (Math.random() > 0.5) tempColor.offsetHSL(0, 0, 0.05);
                
                instancedMesh.setColorAt(instanceIndex, tempColor);
                instanceIndex++;
            }
        }

        scene.add(instancedMesh);

        update = (time: number) => {
            customUniforms.uTime.value = time;
        };

        cleanup = () => {
            scene.remove(instancedMesh);
            planeGeo.dispose();
            baseGeo.dispose();
            clusterTexture.dispose();
            material.dispose();
        };

    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};