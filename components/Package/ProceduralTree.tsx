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

// Volumetric helper for leaf clouds
const randomInSphere = (radius: number, center: THREE.Vector3, target: THREE.Vector3) => {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(Math.random()) * radius; // cbrt for uniform density
    const sinPhi = Math.sin(phi);
    target.x = center.x + r * sinPhi * Math.cos(theta);
    target.y = center.y + r * sinPhi * Math.sin(theta);
    target.z = center.z + r * Math.cos(phi);
};

const createDenseClusterTexture = () => {
  const size = 32; // OPTIMIZED: Reduced to 32px for ultra-low-res stylized look
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

  // Layer 1: Background fan
  for(let i=0; i<24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.28);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.09) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*0.5 - 0.25));
  }

  // Layer 2: Main body
  for(let i=0; i<18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.18); 
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.07) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*1.0 - 0.5));
  }

  // Layer 3: Detail highlights
  for(let i=0; i<12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.06);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.06) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, Math.random() * Math.PI * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; 
  return tex;
};

// --- LOGIC ---

export const createTrees = (
    scene: THREE.Scene, 
    camera: THREE.Camera, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const seed = 987654; 
    const rng = mulberry32(seed);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { uTime: { value: 0 } };
        const count = positions.length;

        // GEOMETRY
        // Reusable Unit Cylinder for both trunks and branches
        // OPTIMIZED: Reduced radial segments to 3 for ultra low-poly (triangular prism) look
        // TAPERED: Radius top 0.3, bottom 1.0 for stronger taper on all branches
        const woodGeo = new THREE.CylinderGeometry(0.3, 1.0, 1, 3);
        woodGeo.translate(0, 0.5, 0); // Pivot at base

        const leafGeo = new THREE.PlaneGeometry(1, 1, 1, 1);

        // MATERIALS
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x8D7B68, 
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
                float windSway = sin(uTime * 0.5 + instanceMatrix[3].x * 0.3) * 0.05;
                float bend = windSway * (position.y * position.y * 0.04); 
                transformed.x += bend;
                `
            );
        };

        const clusterTexture = createDenseClusterTexture();
        const leafMaterial = new THREE.MeshStandardMaterial({
            map: clusterTexture,
            alphaTest: 0.45, 
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: false,
        });

        leafMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>\nuniform float uTime; float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
                float dist = length(uv - 0.5);
                transformed.z -= dist * dist * 1.5 * step(0.9, abs(normal.z)); // Puffiness
                
                float windPhase = uTime * 0.8 + instanceMatrix[3].x * 0.5;
                float windOffset = (sin(windPhase) + sin(windPhase * 2.5 + id * 5.0) * 0.15) * uv.y * 0.05;
                
                transformed.x += windOffset; 
                transformed.z += windOffset * 0.3; 
                transformed.y += sin(windPhase * 1.5) * uv.y * 0.02; 
                `
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>\nfloat planeGradient = mix(0.6, 1.1, vMapUv.y); diffuseColor.rgb *= planeGradient;`
            );
        };

        // SETUP INSTANCING
        const branchesPerTree = 12; // INCREASED: More branches
        const woodInstances = count * (1 + branchesPerTree); // 1 Trunk + N Branches
        const woodMesh = new THREE.InstancedMesh(woodGeo, trunkMaterial, woodInstances);
        woodMesh.castShadow = true;
        woodMesh.receiveShadow = true;

        const leavesPerCluster = 140; // INCREASED: Very dense leaf clusters
        // 1 Main Cluster (Top) + N Branch Clusters
        const totalLeaves = count * (1 + branchesPerTree) * leavesPerCluster;
        const leafMesh = new THREE.InstancedMesh(leafGeo, leafMaterial, totalLeaves);
        leafMesh.castShadow = true;
        leafMesh.receiveShadow = false;

        const dummy = new THREE.Object3D();
        const _pos = new THREE.Vector3();
        const _target = new THREE.Vector3();
        const upVector = new THREE.Vector3(0, 1, 0);
        const tempColor = new THREE.Color();

        let woodIdx = 0;
        let leafIdx = 0;

        for (let i = 0; i < count; i++) {
            const p = positions[i];
            const gElev = getGroundElevation(p.x, p.z) * 0.3;
            // Sink slightly to hide base
            const treeY = -1.5 + gElev - 0.2;
            const treeBase = new THREE.Vector3(p.x, treeY, p.z);
            
            // --- 1. TRUNK ---
            const trunkHeight = 4.5 + Math.random() * 2.0;
            const trunkWidth = 0.25 + Math.random() * 0.1;
            
            dummy.position.copy(treeBase);
            dummy.rotation.set((Math.random()-0.5)*0.1, Math.random()*Math.PI, (Math.random()-0.5)*0.1);
            dummy.scale.set(trunkWidth, trunkHeight, trunkWidth);
            dummy.updateMatrix();
            woodMesh.setMatrixAt(woodIdx++, dummy.matrix);

            // Store trunk transform for attaching branches
            const trunkMatrix = dummy.matrix.clone();
            const trunkTop = new THREE.Vector3(0, 1, 0).applyMatrix4(trunkMatrix);

            // --- 2. BRANCHES ---
            const branchTips: THREE.Vector3[] = [];
            // Add trunk top as a tip for leaves
            branchTips.push(trunkTop);

            for (let b = 0; b < branchesPerTree; b++) {
                // Distribute branches along top 50% of trunk (higher canopy)
                const hRatio = 0.5 + 0.45 * (b / (branchesPerTree - 1)) + (Math.random() * 0.1);
                const attachPoint = new THREE.Vector3(0, hRatio, 0).applyMatrix4(trunkMatrix);
                
                // Spiral distribution
                const angle = b * 2.4 + Math.random() * 0.5; // Golden angle-ish
                const leanUp = 0.5 + Math.random() * 0.4; // 0=flat, 1.5=straight up

                // Branch geometry params
                const branchLen = (trunkHeight * 0.35) * (1.0 - hRatio * 0.5); // Lower branches longer
                const branchWidth = trunkWidth * 0.6 * (1.0 - hRatio * 0.4);

                dummy.position.copy(attachPoint);
                // Rotate to face outward + up
                dummy.rotation.set(0, angle, 0); // Y rotation
                dummy.rotateX(leanUp); // Tilt up
                dummy.rotateZ((Math.random()-0.5)*0.2); // Random wobble
                
                dummy.scale.set(branchWidth, branchLen, branchWidth);
                dummy.updateMatrix();
                woodMesh.setMatrixAt(woodIdx++, dummy.matrix);

                // Calculate tip position for leaves
                const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(dummy.matrix);
                branchTips.push(tip);
            }

            // --- 3. LEAVES (Clouds at tips) ---
            for (const tip of branchTips) {
                // Randomize cluster size (Larger for more leaves)
                const clusterRadius = 1.4 + Math.random() * 0.8;

                for (let l = 0; l < leavesPerCluster; l++) {
                    // Volumetric placement
                    randomInSphere(clusterRadius, tip, _target);
                    
                    dummy.position.copy(_target);
                    
                    // Face normal outwards from cluster center for fluffiness
                    _pos.subVectors(_target, tip).normalize();
                    _pos.lerp(upVector, 0.6).normalize(); // Blend with up vector
                    
                    dummy.lookAt(_target.clone().add(_pos));
                    dummy.rotateZ(Math.random() * Math.PI * 2);

                    // Scale leaves: larger in center of cluster, smaller at edges
                    const dist = _target.distanceTo(tip);
                    const scaleFalloff = 1.0 - (dist / clusterRadius) * 0.5;
                    const s = (1.8 + Math.random() * 1.0) * scaleFalloff;
                    
                    dummy.scale.set(s, s, s);
                    dummy.updateMatrix();
                    leafMesh.setMatrixAt(leafIdx, dummy.matrix);

                    // Synced Palette
                    const v = Math.random();
                    if (v > 0.75) tempColor.setHex(0xB2D8B2); 
                    else if (v > 0.35) tempColor.setHex(0x88C488); 
                    else tempColor.setHex(0x66A566);
                    
                    // Variation
                    tempColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
                    leafMesh.setColorAt(leafIdx++, tempColor);
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
            clusterTexture.dispose();
        };

    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};
