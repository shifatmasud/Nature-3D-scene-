
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
import { getGroundElevation } from './Ground.tsx';

// --- HELPERS ---

const createFlowerTexture = () => {
  const size = 128; 
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  // 1. White Square for Stem UVs (Top Left 8x8)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 8, 8);

  // 2. Flower Head (Centered)
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;

  ctx.save();
  ctx.translate(cx, cy);
  
  // Draw Petals
  const petals = 5;
  ctx.fillStyle = '#FFFFFF'; 
  for (let i = 0; i < petals; i++) {
    ctx.rotate((Math.PI * 2) / petals);
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.5, radius * 0.25, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw Center
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF'; 
  ctx.fill();
  
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const createFlowerPatchGeometry = () => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const flowerCount = 12; // Denser chunk since they are single planes now
    const patchRadius = 0.6;

    const palette = [
        new THREE.Color(0xFFB7B2), // Pink
        new THREE.Color(0xE0BBE4), // Purple
        new THREE.Color(0xFFF4BD)  // Yellow
    ];
    const stemColor = new THREE.Color(0x558833); // Nice Green

    let vertOffset = 0;

    // Helper to push a quad (2 triangles)
    const pushQuad = (
        p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, p4: THREE.Vector3, 
        uvMin: THREE.Vector2, uvMax: THREE.Vector2, 
        color: THREE.Color
    ) => {
        // Positions
        positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z);
        
        // Normals (Calculated from face)
        const vA = new THREE.Vector3().subVectors(p2, p1);
        const vB = new THREE.Vector3().subVectors(p4, p1);
        const norm = new THREE.Vector3().crossVectors(vA, vB).normalize();
        
        for(let k=0; k<4; k++) normals.push(norm.x, norm.y, norm.z);

        // UVs
        uvs.push(uvMin.x, uvMin.y,  uvMax.x, uvMin.y,  uvMin.x, uvMax.y,  uvMax.x, uvMax.y);

        // Colors
        for(let k=0; k<4; k++) colors.push(color.r, color.g, color.b);

        // Indices
        indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset + 2, vertOffset + 1, vertOffset + 3);
        vertOffset += 4;
    };

    for(let i=0; i<flowerCount; i++) {
        // Random Position in patch
        const anglePos = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * patchRadius; 
        const x = Math.cos(anglePos) * r;
        const z = Math.sin(anglePos) * r;

        // Random Rotation (Facing) for this specific flower
        const rotY = Math.random() * Math.PI * 2;
        const dx = Math.cos(rotY);
        const dz = Math.sin(rotY);

        // Random Size
        const scale = 0.8 + Math.random() * 0.4;
        const stemHeight = 0.5 * scale;
        const headSize = 0.3 * scale;

        // Pick Color (Strictly one from palette)
        const headColor = palette[Math.floor(Math.random() * palette.length)];

        // --- 1. STEM GEOMETRY (Single Billboard Plane) ---
        const stemW = 0.04 * scale;
        
        // Calculate offsets based on rotation
        const sx = dx * stemW;
        const sz = dz * stemW;

        pushQuad(
            new THREE.Vector3(x - sx, 0, z - sz),
            new THREE.Vector3(x + sx, 0, z + sz),
            new THREE.Vector3(x - sx, stemHeight, z - sz),
            new THREE.Vector3(x + sx, stemHeight, z + sz),
            new THREE.Vector2(0, 0), new THREE.Vector2(0.06, 0.06), // White square UV
            stemColor
        );

        // --- 2. HEAD GEOMETRY (Single Billboard Plane) ---
        const hS = headSize / 2;
        const hx = dx * hS;
        const hz = dz * hS;
        
        // Head sits at top of stem, centered
        const hY = stemHeight; // Bottom of head is slightly below top of stem? No, lets center it vertically on tip or sit on top.
        // Let's make head a quad centered at tip height roughly
        
        const headBottom = hY - hS;
        const headTop = hY + hS;

        pushQuad(
            new THREE.Vector3(x - hx, headBottom, z - hz),
            new THREE.Vector3(x + hx, headBottom, z + hz),
            new THREE.Vector3(x - hx, headTop, z - hz),
            new THREE.Vector3(x + hx, headTop, z + hz),
            new THREE.Vector2(0, 0), new THREE.Vector2(1, 1), 
            headColor
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    return geometry;
};

// --- LOGIC ---

export const createFlowers = (
    scene: THREE.Scene, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { uTime: { value: 0 } };
        const count = positions.length;

        // 1. Create Texture
        const texture = createFlowerTexture();

        // 2. Create Geometry (Patch)
        const geometry = createFlowerPatchGeometry();

        // 3. Material
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            roughness: 1.0,
            metalness: 0.0,
            vertexColors: true 
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>\nuniform float uTime;\nfloat hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
                
                // Wind Animation
                float windPhase = uTime * 1.5 + instanceMatrix[3].x * 0.5;
                
                // Sway based on height (position.y)
                float sway = sin(windPhase + position.x * 2.0) * 0.1 * position.y; 
                float flutter = sin(windPhase * 3.0 + id * 10.0) * 0.05 * position.y;
                
                transformed.x += sway + flutter;
                transformed.z += flutter;
                `
            );
        };

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = false; 
        mesh.receiveShadow = false;

        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < count; i++) {
            const p = positions[i];
            const gElev = getGroundElevation(p.x, p.z) * 0.3;
            // Sink slightly
            const y = -1.5 + gElev - 0.05; 

            dummy.position.set(p.x, y, p.z);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            
            const s = 0.9 + Math.random() * 0.2;
            dummy.scale.set(s, s, s);
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        scene.add(mesh);

        update = (time: number) => {
            customUniforms.uTime.value = time;
        };

        cleanup = () => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            texture.dispose();
        };

    } catch (e) {
        console.error("Flower generation failed", e);
    }

    return { update, cleanup };
};
