/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
// We don't need getGroundElevation in JS anymore as we move it to Shader for chunks
// but we keep the import if we need it for other logic, though we can remove it if unused.

// --- HELPERS ---

const createGrassTuftTexture = () => {
  const size = 64; 
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
    ctx.moveTo(-width / 2, 0); 
    ctx.quadraticCurveTo(-width * 0.1, -height * 0.5, 0, -height); 
    ctx.quadraticCurveTo(width * 0.1, -height * 0.5, width / 2, 0); 
    ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, -height, 0, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); 
    grad.addColorStop(1, 'rgba(180, 180, 180, 1.0)'); 
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

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
  texture.minFilter = THREE.LinearFilter; 
  texture.magFilter = THREE.LinearFilter;
  return texture;
};

// --- CHUNK GEOMETRY GENERATOR ---

const createGrassChunkGeometry = (bladesPerChunk: number, chunkSize: number) => {
  const geometry = new THREE.BufferGeometry();
  
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const phases: number[] = []; // Per-vertex attribute for wind variation

  // Create a single cross-plane template
  const basePlane = [
    { x: -0.5, y: 0, u: 0, v: 0 },
    { x:  0.5, y: 0, u: 1, v: 0 },
    { x: -0.5, y: 1, u: 0, v: 1 },
    { x:  0.5, y: 1, u: 1, v: 1 }
  ];
  
  // 2 planes for a cross
  const planes = [
    { angle: 0 },
    { angle: Math.PI / 2 }
  ];

  let vertOffset = 0;

  for (let i = 0; i < bladesPerChunk; i++) {
    // Random position within chunk area (SQUARE AREA)
    const lx = (Math.random() - 0.5) * chunkSize;
    const lz = (Math.random() - 0.5) * chunkSize;
    
    // Random scale
    const scale = 0.8 + Math.random() * 0.6;
    const scaleH = scale * (0.8 + Math.random() * 0.4);

    // Random rotation
    const rotY = Math.random() * Math.PI * 2;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    // Random wind phase
    const phase = Math.random() * Math.PI * 2;

    // Build the blade (2 planes)
    planes.forEach(plane => {
        // Plane rotation (local to blade) + Blade rotation (local to chunk)
        const totalRot = plane.angle + rotY; 
        const c = Math.cos(totalRot);
        const s = Math.sin(totalRot);

        const currentPlaneIndices = [0, 1, 2, 1, 3, 2];
        
        // Vertices
        basePlane.forEach((v, idx) => {
            // 1. Scale geometry
            let vx = v.x * scale;
            let vy = v.y * scaleH;
            
            // 2. Rotate plane
            let rx = vx * c;
            let rz = vx * s;

            // 3. Translate to chunk position
            let fx = rx + lx;
            let fz = rz + lz;
            let fy = vy; // Local Y (bottom is 0)

            positions.push(fx, fy, fz);
            uvs.push(v.u, v.v);
            normals.push(0, 1, 0); // Simplified normal pointing up
            phases.push(phase);
        });

        // Indices
        currentPlaneIndices.forEach(idx => {
            indices.push(vertOffset + idx);
        });
        vertOffset += 4;
    });
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere(); // Important for culling
  
  return geometry;
};

// --- LOGIC ---

export const createGrass = (
    scene: THREE.Scene, 
    camera: THREE.Camera, 
    theme: any, 
    chunkCount: number, // Interpreted as number of chunks now
    obstacles: {x: number, z: number, r?: number}[] = [] // "Smart" obstacles (Rocks, Bushes)
) => {
    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { uTime: { value: 0 } };
        const grassTexture = createGrassTuftTexture();

        // CHUNK CONFIG - MASSIVE PATCHES
        // 500 Blades merged into one geometry.
        // Chunk size 8.5 covers a large area.
        const BLADES_PER_CHUNK = 500; 
        const CHUNK_SIZE = 8.5; 

        // Generate Chunk Mesh
        const geometry = createGrassChunkGeometry(BLADES_PER_CHUNK, CHUNK_SIZE);

        // --- MATERIAL ---
        const material = new THREE.MeshStandardMaterial({
            map: grassTexture,
            alphaTest: 0.35, 
            side: THREE.DoubleSide,
            color: 0xffffff,
            roughness: 1.0, 
            metalness: 0,
        });

        // --- PREPARE OBSTACLE UNIFORM ---
        // We pack obstacles into a vec3 array [x, z, radius] for the shader.
        const MAX_OBSTACLES = 50;
        const obstacleData = new Float32Array(MAX_OBSTACLES * 3);
        
        obstacles.forEach((op, i) => {
            if(i < MAX_OBSTACLES) {
                obstacleData[i*3] = op.x;
                obstacleData[i*3+1] = op.z;
                obstacleData[i*3+2] = op.r || 1.5;
            }
        });
        // Fill remaining slots with zero radius (inactive) or far away
        for(let i = obstacles.length; i < MAX_OBSTACLES; i++) {
             obstacleData[i*3] = 9999;
             obstacleData[i*3+1] = 9999;
             obstacleData[i*3+2] = 0; 
        }

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uObstacles = { value: obstacleData };
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform vec3 uObstacles[${MAX_OBSTACLES}];
                attribute float aPhase;
                
                // Matches Ground.tsx math
                float getElevation(vec2 p) {
                    float e = 0.0;
                    e += sin(p.x * 0.3) * 0.5;
                    e += sin(p.y * 0.2) * 0.5;
                    e += sin(p.x * 0.8 + p.y * 0.6) * 0.1;
                    return e;
                }
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // 1. Calculate World Position of this vertex (assuming instanceMatrix places chunk)
                vec4 worldPos = instanceMatrix * vec4(transformed, 1.0);
                
                // 2. SMART BORDER DETECTION
                // Check all obstacles. If inside radius, shrink the blade.
                float mask = 1.0;
                for(int i = 0; i < ${MAX_OBSTACLES}; i++) {
                    vec3 obs = uObstacles[i];
                    if(obs.z > 0.0) {
                        float dist = distance(worldPos.xz, obs.xy);
                        // Smoothly scale down grass as it approaches the obstacle
                        mask *= smoothstep(obs.z * 0.7, obs.z, dist); 
                    }
                }
                
                // Apply Mask: shrinks the blade towards its local origin (0,0,0)
                // Since blade geometry is built from 0 upwards, this scales height and width down.
                transformed *= mask;

                // 3. Terrain Adhesion (GPU side)
                float groundY = -1.5 + getElevation(worldPos.xz) * 0.3;
                
                // Move blade to ground level.
                // We add groundY AFTER masking, so even if shrunk to 0, it sits at correct height (as a point).
                transformed.y += groundY;

                // 4. Wind Animation
                float windFreq = 0.5; 
                float windAmp = 0.15; 
                
                // Use aPhase (per blade random) + worldPos (per location) for wave
                float phase = uTime * windFreq + worldPos.x * 0.1 + worldPos.z * 0.1 + aPhase;
                
                float sway = sin(phase);
                // Only sway top of blades (stiffness based on original y height)
                // Use 'position.y' which is 0..1 from geometry for stiffness mask.
                float stiffness = smoothstep(0.0, 1.0, position.y);
                
                float combinedWind = sway * stiffness * windAmp;
                
                transformed.x += combinedWind;
                transformed.z += combinedWind * 0.2; 
                `
            );
        };

        // --- INSTANCING ---
        const mesh = new THREE.InstancedMesh(geometry, material, chunkCount);
        mesh.castShadow = false; 
        mesh.receiveShadow = false;

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const spread = 18; 

        let placedCount = 0;

        for (let i = 0; i < chunkCount; i++) {
            let x = 0, z = 0;
            let valid = false;
            let attempts = 0;

            while (!valid && attempts < 20) {
                x = (Math.random() - 0.5) * spread;
                z = (Math.random() - 0.5) * spread;
                
                valid = true;
                
                // JS Avoidance: MINIMAL
                // With 8.5m chunks, we let the shader handle nearly all avoidance.
                // We only check if the chunk CENTER is literally inside an obstacle to save fill rate.
                for (const p of obstacles) {
                    const dx = x - p.x;
                    const dz = z - p.z;
                    const avoidRadius = (p.r || 1.3) * 0.3; // Very permissive
                    const avoidSq = avoidRadius * avoidRadius;
                    
                    if (dx * dx + dz * dz < avoidSq) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            }

            if (!valid) {
                 dummy.position.set(0, -50, 0); // Hide
                 dummy.updateMatrix();
                 mesh.setMatrixAt(i, dummy.matrix);
                 continue;
            }

            placedCount++;
            
            // Place chunk
            dummy.position.set(x, 0, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.setScalar(1.0);
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);

            // COLOR PALETTE
            const v = Math.random();
            if (v > 0.6) {
                color.setHex(0xB2D8B2); 
            } else if (v > 0.2) {
                color.setHex(0x88C488); 
            } else {
                color.setHex(0x66A566); 
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
