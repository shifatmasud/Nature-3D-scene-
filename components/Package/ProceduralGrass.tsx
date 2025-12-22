

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
// We don't need getGroundElevation in JS anymore as we move it to Shader for chunks
// but we keep the import if we need it for other logic, though we can remove it if unused.

// --- HELPERS ---

const createGrassTuftTexture = () => {
  const size = 128; // Increased resolution for better detail
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const drawBlade = (x: number, y: number, width: number, height: number, lean: number, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean); 
    
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0); 
    
    ctx.quadraticCurveTo(-width * 0.1, -height * 0.5, 0, -height); 
    ctx.quadraticCurveTo(width * 0.6, -height * 0.5, width / 2, 0); 
    
    ctx.closePath();
    
    // Softer gradient for a more Ghibli-esque feel
    const grad = ctx.createLinearGradient(0, -height, 0, 0);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`); 
    grad.addColorStop(0.8, `rgba(200, 220, 200, ${alpha})`);
    grad.addColorStop(1, `rgba(140, 180, 140, ${alpha})`); 
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

  // Create a dense, soft clump by layering multiple blades
  const bladeCount = 40; 
  for (let i = 0; i < bladeCount; i++) {
    // Distribute blades in a tight cluster at the bottom center
    const x = size / 2 + (Math.random() - 0.5) * (size * 0.6);
    const y = size; 
    
    const width = (size * 0.08) + Math.random() * (size * 0.06); 
    const height = (size * 0.5) + Math.random() * (size * 0.4);
    const lean = (Math.random() - 0.5) * 0.5; 
    const alpha = 0.7 + Math.random() * 0.3; // Alpha variation for depth
    
    drawBlade(x, y, width, height, lean, alpha);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter; 
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
  const phases: number[] = []; 

  // UPDATED: Base Plane with 2 Height Segments (3 Rows) for bending
  // Row 0 (Bottom), Row 1 (Middle), Row 2 (Top)
  const basePlane = [
    // Row 0 (y=0)
    { x: -0.5, y: 0.0, u: 0, v: 0 },
    { x:  0.5, y: 0.0, u: 1, v: 0 },
    // Row 1 (y=0.5)
    { x: -0.5, y: 0.5, u: 0, v: 0.5 },
    { x:  0.5, y: 0.5, u: 1, v: 0.5 },
    // Row 2 (y=1.0)
    { x: -0.5, y: 1.0, u: 0, v: 1 },
    { x:  0.5, y: 1.0, u: 1, v: 1 }
  ];
  
  // Indices for 2 stacked quads (4 triangles)
  // Vertices: 0,1 (Row0), 2,3 (Row1), 4,5 (Row2)
  const baseIndices = [
    0, 1, 2,  1, 3, 2, // Bottom Quad
    2, 3, 4,  3, 5, 4  // Top Quad
  ];
  
  // UPDATED: From 2 planes ('+') to 3 planes ('*') for a fuller, fluffier look
  const planes = [
    { angle: 0 },
    { angle: (Math.PI * 2) / 3 },     // 120 degrees
    { angle: (Math.PI * 2) / 3 * 2 }  // 240 degrees
  ];

  let vertOffset = 0;

  for (let i = 0; i < bladesPerChunk; i++) {
    const lx = (Math.random() - 0.5) * chunkSize;
    const lz = (Math.random() - 0.5) * chunkSize;
    
    const scale = 1.5 + Math.random() * 1.0;
    const scaleH = scale * (0.8 + Math.random() * 0.4);

    const rotY = Math.random() * Math.PI * 2;

    const phase = Math.random() * Math.PI * 2;

    planes.forEach(plane => {
        const totalRot = plane.angle + rotY; 
        const c = Math.cos(totalRot);
        const s = Math.sin(totalRot);
        
        // Vertices
        basePlane.forEach((v, idx) => {
            let vx = v.x * scale;
            let vy = v.y * scaleH;
            
            let rx = vx * c;
            let rz = vx * s;

            let fx = rx + lx;
            let fz = rz + lz;
            let fy = vy; 

            positions.push(fx, fy, fz);
            uvs.push(v.u, v.v);
            normals.push(0, 1, 0); 
            phases.push(phase);
        });

        // Indices
        baseIndices.forEach(idx => {
            indices.push(vertOffset + idx);
        });
        vertOffset += 6; // 6 vertices per plane
    });
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  
  return geometry;
};

// --- LOGIC ---

export const createGrass = (
    scene: THREE.Scene, 
    camera: THREE.Camera, 
    theme: any, 
    chunkCount: number, 
    obstacles: {x: number, z: number, r?: number}[] = [] 
) => {
    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { uTime: { value: 0 } };
        const grassTexture = createGrassTuftTexture();

        const BLADES_PER_CHUNK = 20; 
        const CHUNK_SIZE = 8.0; 

        const geometry = createGrassChunkGeometry(BLADES_PER_CHUNK, CHUNK_SIZE);

        const material = new THREE.MeshStandardMaterial({
            map: grassTexture,
            alphaTest: 0.35, 
            side: THREE.DoubleSide,
            color: 0xffffff,
            roughness: 1.0, 
            metalness: 0,
        });

        const MAX_OBSTACLES = 10;
        const obstacleData = new Float32Array(MAX_OBSTACLES * 3);
        
        obstacles.forEach((op, i) => {
            if(i < MAX_OBSTACLES) {
                obstacleData[i*3] = op.x;
                obstacleData[i*3+1] = op.z;
                obstacleData[i*3+2] = op.r || 1.5;
            }
        });
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
                
                // FIX: Synchronized with Ground.tsx shader
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
                
                vec4 worldPos = instanceMatrix * vec4(position, 1.0);
                
                // SMART BORDER DETECTION
                float mask = 1.0;
                for(int i = 0; i < ${MAX_OBSTACLES}; i++) {
                    vec3 obs = uObstacles[i];
                    if(obs.z > 0.0) {
                        vec2 d = worldPos.xz - obs.xy;
                        float distSq = dot(d, d);
                        float rSq = obs.z * obs.z;
                        if(distSq < rSq) {
                             float factor = distSq / rSq; 
                             mask *= factor * factor;
                        }
                    }
                }
                transformed *= mask;

                // Terrain Adhesion
                float groundY = -1.5 + getElevation(worldPos.xz) * 0.3;
                transformed.y += groundY;

                // UPDATED: Curvy Physics + Wind
                // 1. Static "Gravity Bend" (Curvy look)
                // Bends the tip outwards based on height
                float curveAmount = 0.4;
                float bend = pow(position.y, 1.5) * curveAmount;
                // Add random direction to bend to make it chaotic
                transformed.x += bend * sin(aPhase); 
                transformed.z += bend * cos(aPhase);

                // 2. Dynamic Wind Sway
                float windFreq = 0.5; 
                float phase = uTime * windFreq + worldPos.x * 0.1 + aPhase;
                float sway = sin(phase) * smoothstep(0.0, 1.0, position.y) * 0.15;
                
                transformed.x += sway;
                `
            );
        };

        const mesh = new THREE.InstancedMesh(geometry, material, chunkCount);
        mesh.castShadow = false; 
        mesh.receiveShadow = false;
        mesh.frustumCulled = true; 

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        // UPDATED: Reduced spread to ensure grass stays within ground plane (20x20)
        // Chunk (8) + Spread (11) = Max Extent ~9.5 < 10.0
        const spread = 11; 

        for (let i = 0; i < chunkCount; i++) {
            let x = 0, z = 0;
            let valid = false;
            let attempts = 0;

            while (!valid && attempts < 20) {
                x = (Math.random() - 0.5) * spread;
                z = (Math.random() - 0.5) * spread;
                valid = true;
                
                for (const p of obstacles) {
                    const dx = x - p.x;
                    const dz = z - p.z;
                    if (dx * dx + dz * dz < 1.0) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            }

            if (!valid) {
                 dummy.position.set(0, -50, 0); 
                 dummy.updateMatrix();
                 mesh.setMatrixAt(i, dummy.matrix);
                 continue;
            }
            
            dummy.position.set(x, 0, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.setScalar(1.0);
            dummy.updateMatrix();
            // FIX: Pass the transformation matrix, not the color object.
            mesh.setMatrixAt(i, dummy.matrix);

            const v = Math.random();
            if (v > 0.6) color.setHex(0xB2D8B2); 
            else if (v > 0.2) color.setHex(0x88C488); 
            else color.setHex(0x66A566);
            
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
