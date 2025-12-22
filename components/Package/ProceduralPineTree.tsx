

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
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

// TEXTURE GENERATION: Stylized "Bottle Brush" Pine Bough
// More detail than a blob, but still soft and friendly (no sharp pixelated needles)
const createFriendlyPineTexture = () => {
  const size = 64; // OPTIMIZED: Reduced resolution to 64px
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#FFFFFF"; 

  const cx = size / 2;
  const bottom = size * 0.9;
  const top = size * 0.1;
  const height = bottom - top;

  // Draw Central Stem (Subtle)
  ctx.beginPath();
  ctx.moveTo(cx - 2, bottom);
  ctx.lineTo(cx + 2, bottom);
  ctx.lineTo(cx, top);
  ctx.fill();

  // Draw Soft Needles / Tufts
  const rows = 12;
  for(let i = 0; i <= rows; i++) {
      const t = i / rows; // 0 (bottom) to 1 (top)
      const y = bottom - (t * height);
      
      // Shape profile: Widest near bottom, tapering to top
      const width = (size * 0.45) * (1.0 - t * 0.6);
      
      // Draw symmetrical rounded tufts
      const angle = 0.2 - t * 0.4; // Slightly fanned out
      const needleLen = width * (0.8 + Math.random() * 0.4);
      const thickness = (size * 0.08) * (1.0 - t * 0.5);

      // Left tuft
      ctx.save();
      ctx.translate(cx, y);
      ctx.rotate(-1.5 - angle); // Pointing roughly left/out
      ctx.beginPath();
      ctx.ellipse(needleLen/2, 0, needleLen/2, thickness/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // Right tuft
      ctx.save();
      ctx.translate(cx, y);
      ctx.rotate(1.5 + angle); // Pointing roughly right/out
      ctx.beginPath();
      ctx.ellipse(needleLen/2, 0, needleLen/2, thickness/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      
      // Center filler tuft (for volume)
      if(i % 2 === 0) {
        ctx.save();
        ctx.translate(cx, y);
        ctx.beginPath();
        ctx.ellipse(0, 0, thickness, thickness*1.5, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
  }

  // Tip tuft
  ctx.beginPath();
  ctx.arc(cx, top, size * 0.06, 0, Math.PI*2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
};

// --- LOGIC ---

export const createPineTrees = (
    scene: THREE.Scene, 
    camera: THREE.Camera, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const seed = 334455; 
    const rng = mulberry32(seed);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { uTime: { value: 0 } };
        const count = positions.length;

        // GEOMETRY
        // Trunk: Dark Cylinder, Sharp Tip
        const woodGeo = new THREE.CylinderGeometry(0.0, 0.4, 1, 5);
        woodGeo.translate(0, 0.5, 0);

        // Leaf: Plane instance
        const leafGeo = new THREE.PlaneGeometry(1, 1);
        leafGeo.translate(0, 0.5, 0); 

        // MATERIALS
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0xBEB28D, 
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true,
        });

        trunkMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>\nuniform float uTime;`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float windSway = sin(uTime * 0.5 + instanceMatrix[3].x * 0.3) * 0.02;
                float bend = windSway * (position.y * position.y * 0.03); 
                transformed.x += bend;
                `
            );
        };

        const boughTexture = createFriendlyPineTexture();
        const leafMaterial = new THREE.MeshStandardMaterial({
            map: boughTexture,
            alphaTest: 0.5, 
            side: THREE.DoubleSide,
            roughness: 1.0, 
            metalness: 0.0,
            color: 0xffffff,
        });

        leafMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>\nuniform float uTime; float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <beginnormal_vertex>',
                `
                #include <beginnormal_vertex>
                vec3 localPos = position - vec3(0.0, 0.5, 0.0);
                objectNormal = normalize(localPos + vec3(0.0, 0.2, 0.0));
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
                float windPhase = uTime * 0.8 + instanceMatrix[3].x * 0.5;
                
                float sway = sin(windPhase + id * 5.0) * 0.1 * uv.y;
                float flutter = sin(windPhase * 3.0 + uv.x * 5.0) * 0.03 * uv.y;
                
                transformed.x += sway;
                transformed.z += flutter;
                `
            );
        };

        // INSTANCING SETUP
        const layers = 20; // Increased density from 10 to 20
        const branchesPerLayer = 8; // Increased density from 6 to 8
        
        const totalBranches = layers * branchesPerLayer;
        // REMOVED: Branches are now just leaf billboards (no wood geometry)
        const woodInstances = count; 
        // 1 leaf per branch (Removed top tip billboard)
        const totalLeaves = count * totalBranches;

        const woodMesh = new THREE.InstancedMesh(woodGeo, trunkMaterial, woodInstances);
        woodMesh.castShadow = true;
        woodMesh.receiveShadow = true;

        const leafMesh = new THREE.InstancedMesh(leafGeo, leafMaterial, totalLeaves);
        leafMesh.castShadow = true;
        leafMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        const dummyWood = new THREE.Object3D();
        const color = new THREE.Color();
        
        const _start = new THREE.Vector3();
        const _end = new THREE.Vector3();
        const _diff = new THREE.Vector3();

        let woodIdx = 0;
        let leafIdx = 0;

        for (let i = 0; i < count; i++) {
            const p = positions[i];
            const gElev = getGroundElevation(p.x, p.z) * 0.3;
            const treeY = -1.5 + gElev - 0.2;
            const treeBase = new THREE.Vector3(p.x, treeY, p.z);
            
            // --- 1. TRUNK ---
            const trunkHeight = 7.5 + Math.random() * 2.0; 
            const trunkWidth = 0.4 + Math.random() * 0.1;
            
            dummyWood.position.copy(treeBase);
            dummyWood.rotation.set((Math.random()-0.5)*0.05, Math.random()*Math.PI, (Math.random()-0.5)*0.05);
            dummyWood.scale.set(trunkWidth, trunkHeight, trunkWidth);
            dummyWood.updateMatrix();
            woodMesh.setMatrixAt(woodIdx++, dummyWood.matrix);

            const trunkMatrix = dummyWood.matrix.clone();
            const trunkQuat = dummyWood.quaternion.clone();

            // --- 2. BRANCHES ---
            for (let l = 0; l < layers; l++) {
                const t = l / (layers - 1); // 0 at top, 1 at bottom
                
                // HEIGHT DISTRIBUTION
                const startH = 0.95;
                const endH = 0.25; // Extended lower to cover more trunk
                
                const baseHRatio = startH - (t * (startH - endH)); 
                
                // Reduced cone radius spread for shorter branches
                const coneRadius = 0.2 + (t * 1.8);

                for(let b=0; b<branchesPerLayer; b++) {
                    // Jitter height to avoid perfect rings, covers trunk better
                    const hJitter = (Math.random() - 0.5) * 0.04;
                    const hRatio = baseHRatio + hJitter;

                    const angle = (b / branchesPerLayer) * Math.PI * 2 + (l * 2.5);
                    
                    const branchLen = coneRadius * (0.8 + Math.random() * 0.4);
                    const droop = 0.5 + (t * 0.4); 
                    
                    const dx = Math.cos(angle) * branchLen;
                    const dz = Math.sin(angle) * branchLen;
                    const dy = -Math.sin(droop) * branchLen;
                    
                    _start.set(0, hRatio, 0).applyMatrix4(trunkMatrix);
                    _end.set(dx, dy, dz).applyQuaternion(trunkQuat).add(_start);
                    
                    // --- 3. BOUGH (Single Billboard) ---
                    _diff.subVectors(_end, _start);
                    
                    // Position at base of branch
                    dummy.position.copy(_start);
                    
                    // Orient: Align Y axis (up) of plane with branch vector
                    dummy.lookAt(_end);
                    dummy.rotateX(Math.PI / 2); 
                    
                    // Roll: Random rotation around branch axis to provide volume
                    dummy.rotateY(Math.random() * Math.PI * 2);
                    
                    // Scale: Match branch length plus some overlap
                    const s = branchLen * 1.5;
                    dummy.scale.set(s, s, s);
                    
                    dummy.updateMatrix();
                    leafMesh.setMatrixAt(leafIdx, dummy.matrix);

                    // COLOR
                    const v = Math.random();
                    if(v > 0.7) color.setHex(0xB2D8B2);      
                    else if(v > 0.3) color.setHex(0x88C488); 
                    else color.setHex(0x66A566);             
                    
                    color.offsetHSL(0, 0, (Math.random()-0.5)*0.05);
                    leafMesh.setColorAt(leafIdx, color);
                    leafIdx++;
                }
            }
        }

        scene.add(woodMesh);
        scene.add(leafMesh);

        update = (time: number) => {
            customUniforms.uTime.value = time;
        };

        cleanup = () => {
            scene.remove(woodMesh);
            scene.remove(leafMesh);
            woodGeo.dispose();
            leafGeo.dispose();
            trunkMaterial.dispose();
            leafMaterial.dispose();
            boughTexture.dispose();
        };

    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};