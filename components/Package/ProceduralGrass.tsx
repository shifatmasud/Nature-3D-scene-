/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
import { getGroundElevation } from './Ground.tsx';

// --- HELPERS ---

const createGrassTuftTexture = () => {
  const size = 64; // ADJUSTED: Reduced from 128 to 64 to soften over-sharp aliasing (digital noise)
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const drawBlade = (x: number, y: number, width: number, height: number, lean: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean); 
    
    ctx.beginPath();
    // Start at bottom center-ish
    ctx.moveTo(-width / 2, 0); 
    
    // SHARP GEOMETRY:
    // Still using the inward-pulled curves for a spiky look, 
    // but the lower resolution texture naturally anti-aliases these tips.
    
    // Left edge
    ctx.quadraticCurveTo(-width * 0.1, -height * 0.5, 0, -height); 
    
    // Right edge
    ctx.quadraticCurveTo(width * 0.1, -height * 0.5, width / 2, 0); 
    
    ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, -height, 0, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); 
    grad.addColorStop(1, 'rgba(180, 180, 180, 1.0)'); 
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

  // Blade distribution
  const bladeCount = 16;
  for (let i = 0; i < bladeCount; i++) {
    const x = size / 2 + (Math.random() - 0.5) * (size * 0.5);
    const y = size; 
    
    const width = (size * 0.06) + Math.random() * (size * 0.05); 
    const height = (size * 0.75) + Math.random() * (size * 0.25);
    const lean = (Math.random() - 0.5) * 0.4; 
    
    drawBlade(x, y, width, height, lean);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // LINEAR FILTERING: Softens the 128px pixels for a smoother look
  texture.minFilter = THREE.LinearFilter; 
  texture.magFilter = THREE.LinearFilter;
  return texture;
};

// --- LOGIC ---

export const createGrass = (
    scene: THREE.Scene, 
    camera: THREE.Camera, 
    theme: any, 
    count: number,
    // UPDATED: Now supports optional 'r' for radius. Default is ~1.2
    avoidPositions: {x: number, z: number, r?: number}[] = []
) => {
    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { uTime: { value: 0 } };
        const grassTexture = createGrassTuftTexture();

        // --- GEOMETRY: Optimized Cross Shape (2 planes) ---
        const geometry = (() => {
            const g = new THREE.BufferGeometry();
            const pos: number[] = []; 
            const uv: number[] = []; 
            const normal: number[] = []; 
            const index: number[] = [];
            
            for(let i=0; i<2; i++) {
                const rotation = (Math.PI / 2) * i;
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const offset = pos.length / 3;
                
                const pts = [
                    {x: -0.5, y: 0, u: 0, v: 0}, 
                    {x:  0.5, y: 0, u: 1, v: 0}, 
                    {x: -0.5, y: 1, u: 0, v: 1}, 
                    {x:  0.5, y: 1, u: 1, v: 1}  
                ];

                pts.forEach(p => {
                    const rx = p.x * cos;
                    const rz = p.x * sin;
                    pos.push(rx, p.y, rz);
                    uv.push(p.u, p.v);
                    normal.push(0, 1, 0);
                });

                index.push(offset, offset+1, offset+2);
                index.push(offset+1, offset+3, offset+2);
            }

            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
            g.setIndex(index);
            return g;
        })();

        // --- MATERIAL ---
        const material = new THREE.MeshStandardMaterial({
            map: grassTexture,
            alphaTest: 0.4, // REDUCED: Lowered from 0.5 to allow more soft-edge blending
            side: THREE.DoubleSide,
            color: 0xffffff,
            roughness: 1.0, 
            metalness: 0,
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float windFreq = 0.4; 
                float windAmp = 0.12; 
                float phase = uTime * windFreq + instanceMatrix[3].x * 0.15 + instanceMatrix[3].z * 0.1;
                float sway = sin(phase);
                float stiffness = smoothstep(0.0, 1.0, position.y);
                float combinedWind = sway * stiffness * windAmp;
                transformed.x += combinedWind;
                transformed.z += combinedWind * 0.2; 
                `
            );
        };

        // --- INSTANCING ---
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = false; 
        mesh.receiveShadow = false;

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const spread = 20; 

        let placedCount = 0;

        for (let i = 0; i < count; i++) {
            let x = 0, z = 0;
            let valid = false;
            let attempts = 0;

            // Rejection Sampling
            while (!valid && attempts < 10) {
                x = (Math.random() - 0.5) * spread;
                z = (Math.random() - 0.5) * spread;
                
                valid = true;
                for (const p of avoidPositions) {
                    const dx = x - p.x;
                    const dz = z - p.z;
                    // UPDATED: Use dynamic radius if provided, else default to 1.3
                    const r = p.r || 1.3;
                    const avoidSq = r * r;
                    
                    if (dx * dx + dz * dz < avoidSq) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            }

            if (!valid) {
                 dummy.position.set(0, -100, 0);
                 dummy.scale.set(0, 0, 0);
                 dummy.updateMatrix();
                 mesh.setMatrixAt(i, dummy.matrix);
                 continue;
            }

            placedCount++;
            
            const displacementScale = 0.3; 
            // GROUND SINKING: Subtract 0.1 to sink grass slightly and avoid floating
            const y = getGroundElevation(x, z) * displacementScale - 1.5 - 0.1; 

            dummy.position.set(x, y, z);
            
            const s = 1.2 + Math.random() * 0.6; 
            const heightFactor = 0.6 + Math.random() * 0.3; 
            dummy.scale.set(s, s * heightFactor, s);
            
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.updateMatrix();
            
            mesh.setMatrixAt(i, dummy.matrix);

            // ANIME PALETTE - CUSTOM DISTRIBUTION
            const v = Math.random();
            // 70% Medium (0x88C488), 1% Dark (0x66A566), Rest (29%) Light (0xB2D8B2)
            if (v > 0.71) {
                color.setHex(0xB2D8B2); // Light
            } else if (v > 0.01) {
                color.setHex(0x88C488); // Medium - The Majority
            } else {
                color.setHex(0x66A566); // Dark - Very rare
            }
            
            color.offsetHSL((Math.random() - 0.5) * 0.05, 0, 0);
            mesh.setColorAt(i, color);
        }
        
        scene.add(mesh);

        update = (time: number) => {
            customUniforms.uTime.value = time;
        };

        cleanup = () => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            grassTexture.dispose();
        };

    } catch (e) {
        console.error("Grass generation failed", e);
    }

    return { update, cleanup };
};
