
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
import { ZONE_COLORS } from './LayoutMap.tsx';

// --- HELPERS ---

const mulberry32 = (a: number) => {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};

const createGrassTuftTexture = () => {
  const size = 64; // Reduced resolution for performance
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(111);

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
    
    const grad = ctx.createLinearGradient(0, -height, 0, 0);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`); 
    grad.addColorStop(0.8, `rgba(200, 220, 200, ${alpha})`);
    grad.addColorStop(1, `rgba(140, 180, 140, ${alpha})`); 
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

  const bladeCount = 25; // Reduced for smaller texture
  for (let i = 0; i < bladeCount; i++) {
    const x = size / 2 + (rng() - 0.5) * (size * 0.6);
    const y = size; 
    
    const width = (size * 0.08) + rng() * (size * 0.06); 
    const height = (size * 0.5) + rng() * (size * 0.4);
    const lean = (rng() - 0.5) * 0.5; 
    const alpha = 0.7 + rng() * 0.3;
    
    drawBlade(x, y, width, height, lean, alpha);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter; 
  texture.magFilter = THREE.LinearFilter;
  return texture;
};


// --- GEOMETRY GENERATOR FOR A SINGLE TUFT ---
const createTuftGeometry = () => {
    const geometry = new THREE.BufferGeometry();
    
    const positions: number[] = [];
    const uvs: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Base Plane with 2 Height Segments (3 Rows) for bending
    const basePlane = [
        { x: -0.5, y: 0.0, u: 0, v: 0 }, { x:  0.5, y: 0.0, u: 1, v: 0 },
        { x: -0.5, y: 0.5, u: 0, v: 0.5 }, { x:  0.5, y: 0.5, u: 1, v: 0.5 },
        { x: -0.5, y: 1.0, u: 0, v: 1 }, { x:  0.5, y: 1.0, u: 1, v: 1 }
    ];
    
    const baseIndices = [ 0, 1, 2,  1, 3, 2,  2, 3, 4,  3, 5, 4 ];
    
    const planes = [
        { angle: 0 }, { angle: (Math.PI * 2) / 3 }, { angle: (Math.PI * 2) / 3 * 2 }
    ];

    let vertOffset = 0;

    planes.forEach(plane => {
        const c = Math.cos(plane.angle);
        const s = Math.sin(plane.angle);
        
        basePlane.forEach(v => {
            const rx = v.x * c;
            const rz = v.x * s;
            positions.push(rx, v.y, rz);
            uvs.push(v.u, v.v);
            normals.push(0, 1, 0); 
        });

        baseIndices.forEach(idx => indices.push(vertOffset + idx));
        vertOffset += 6;
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    
    return geometry;
};

// --- LOGIC ---
export const createGrass = (
    scene: THREE.Scene, 
    camera: THREE.Camera, 
    theme: any, 
    tuftCount: number, 
    obstacles: {x: number, z: number, r?: number}[] = [],
    layoutMap: ImageData
) => {
    const originalRandom = Math.random;
    const seed = 54321;
    const rng = mulberry32(seed);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number, frustum: THREE.Frustum) => {};

    try {
        const SPREAD = 20.0;
        const GRID_SIZE = 10; 
        const CELL_SIZE = SPREAD / GRID_SIZE;

        const customUniforms = { 
            uTime: { value: 0 },
            uCameraPosition: { value: new THREE.Vector3() },
        };

        const grassTexture = createGrassTuftTexture();
        const sharedGeometry = createTuftGeometry();
        const sharedMaterial = new THREE.MeshStandardMaterial({
            map: grassTexture,
            alphaTest: 0.1, 
            side: THREE.DoubleSide,
            color: 0xffffff,
            roughness: 1.0, 
            metalness: 0,
            transparent: false, 
        });

        const MAX_OBSTACLES = 15; 
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

        sharedMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uCameraPosition = customUniforms.uCameraPosition;
            shader.uniforms.uObstacles = { value: obstacleData };
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform vec3 uCameraPosition;
                uniform vec3 uObstacles[${MAX_OBSTACLES}];
                attribute float aPhase;
                varying vec3 vWorldPosition;
                varying float vDistToCam;
                
                float getElevation(vec2 p) {
                    return 0.0;
                }
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                vDistToCam = length(worldPos.xyz - uCameraPosition);

                // --- OBSTACLE MASK ---
                float obstacle_mask = 1.0;
                for(int i = 0; i < ${MAX_OBSTACLES}; i++) {
                    vec3 obs = uObstacles[i];
                    if(obs.z > 0.0) {
                        vec2 d = worldPos.xz - obs.xy;
                        float distSq = dot(d, d);
                        float rSq = obs.z * obs.z;
                        if(distSq < rSq) {
                             float factor = distSq / rSq; 
                             obstacle_mask *= factor * factor;
                        }
                    }
                }
                
                vec3 modified_pos = position;

                // --- ANIMATION LOD ---
                float anim_lod_start = 2.0;
                float anim_lod_end = 5.0;
                float anim_lod_factor = 1.0 - smoothstep(anim_lod_start, anim_lod_end, vDistToCam);

                // --- ANIMATION ---
                float windFreq = 0.5;
                float phase = uTime * windFreq + worldPos.x * 0.1 + aPhase;
                float sway_base = sin(phase);
                float sway_detail = sin(phase * 2.5 + worldPos.z * 0.2) * 0.5;
                float sway = (sway_base + sway_detail) * smoothstep(0.0, 1.0, modified_pos.y) * 0.15 * anim_lod_factor;

                // --- Bending ---
                float curveAmount = 0.4;
                float bend = pow(modified_pos.y, 1.5) * curveAmount * anim_lod_factor;
                
                // Apply animations
                modified_pos.x += bend * sin(aPhase);
                modified_pos.z += bend * cos(aPhase);
                modified_pos.x += sway;
                
                modified_pos *= obstacle_mask;
                
                // --- Final Placement ---
                float groundY = -1.5 + getElevation(vec2(worldPos.x, -worldPos.z)) * 0.3 + 0.1;
                modified_pos.y += groundY;
                
                transformed = modified_pos;

                vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                `
            );
            
            shader.fragmentShader = `
            varying vec3 vWorldPosition;
            varying float vDistToCam;

            // --- DITHERING PATTERN (BAYER MATRIX) ---
            float bayer(vec2 v) {
                return ( ( 5.0 * v.x + 3.0 * v.y ) + ( 7.0 * v.x + 2.0 * v.y ) * ( 5.0 * v.x + 3.0 * v.y ) ) * 0.25;
            }
            float bayer(vec2 v, float rep) {
                v *= rep;
                return fract( bayer( floor(v) ) + bayer( fract(v) ) );
            }

            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <alphatest_fragment>',
                `
                // --- DITHERED TRANSPARENCY (replaces standard alphaTest) ---
                float fade_start = 8.0;
                float fade_end = 15.0; // Must end where ground texture starts
                float fade_alpha = 1.0 - smoothstep(fade_start, fade_end, vDistToCam);
                
                if (texture2D(map, vMapUv).a < 0.5) discard;
                
                float dither_val = bayer(gl_FragCoord.xy, 4.0);
                if (dither_val > fade_alpha) {
                    discard;
                }
                `
            );
        };
        
        // --- CLUSTER GENERATION ---
        type TuftData = { matrix: THREE.Matrix4, color: THREE.Color, phase: number };
        const clusters: TuftData[][] = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => []);
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        const MAP_RES = layoutMap.width;
        const grassColor = ZONE_COLORS.GRASS;
        const flowerColor = ZONE_COLORS.FLOWER;

        for (let i = 0; i < tuftCount; i++) {
            let x = 0, z = 0;
            let attempts = 0;
            let valid = false;

            while (!valid && attempts < 10) {
                x = (Math.random() - 0.5) * SPREAD;
                z = (Math.random() - 0.5) * SPREAD;
                
                const u = (x / SPREAD + 0.5);
                const v = (z / SPREAD + 0.5);
                const mapX = Math.floor(u * MAP_RES);
                const mapY = Math.floor(v * MAP_RES);
                const idx = (mapY * MAP_RES + mapX) * 4;
                const r = layoutMap.data[idx];
                const g = layoutMap.data[idx+1];
                const b = layoutMap.data[idx+2];
                
                const isGrassZone = (r === grassColor[0] && g === grassColor[1] && b === grassColor[2]);
                const isFlowerZone = (r === flowerColor[0] && g === flowerColor[1] && b === flowerColor[2]);

                if (isGrassZone || isFlowerZone) {
                    valid = true;
                }
                attempts++;
            }

            if (!valid) continue;
            
            const gridX = Math.floor((x / SPREAD + 0.5) * GRID_SIZE);
            const gridZ = Math.floor((z / SPREAD + 0.5) * GRID_SIZE);
            const clusterIndex = Math.min(gridX + gridZ * GRID_SIZE, clusters.length - 1);
            
            const scale = 1.5 + Math.random() * 1.0;
            const scaleH = scale * (0.8 + Math.random() * 0.4);

            dummy.position.set(x, 0, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scaleH, scale);
            dummy.updateMatrix();

            const v = Math.random();
            if (v > 0.6) color.setHex(0xB2D8B2); 
            else if (v > 0.2) color.setHex(0x88C488); 
            else color.setHex(0x66A566);
            color.offsetHSL((Math.random() - 0.5) * 0.05, 0, 0);
            
            clusters[clusterIndex].push({
                matrix: dummy.matrix.clone(),
                color: color.clone(),
                phase: Math.random() * Math.PI * 2
            });
        }
        
        type ManagedCluster = { mesh: THREE.InstancedMesh, center: THREE.Vector3, boundingBox: THREE.Box3 };
        const managedClusters: ManagedCluster[] = [];

        for (let i = 0; i < clusters.length; i++) {
            const clusterData = clusters[i];
            if (clusterData.length === 0) continue;
            
            clusterData.sort((a, b) => a.phase - b.phase);

            const mesh = new THREE.InstancedMesh(sharedGeometry, sharedMaterial, clusterData.length);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.frustumCulled = true;

            const phases = new Float32Array(clusterData.length);
            for (let j = 0; j < clusterData.length; j++) {
                const data = clusterData[j];
                mesh.setMatrixAt(j, data.matrix);
                mesh.setColorAt(j, data.color);
                phases[j] = data.phase;
            }
            mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
            
            scene.add(mesh);
        }
        
        update = (time: number, frustum: THREE.Frustum) => {
            customUniforms.uTime.value = time;
            customUniforms.uCameraPosition.value.copy(camera.position);
        };

        cleanup = () => {
            const meshesToRemove: THREE.InstancedMesh[] = [];
            scene.traverse((object) => {
                if (object instanceof THREE.InstancedMesh && object.material === sharedMaterial) {
                    meshesToRemove.push(object);
                }
            });
            meshesToRemove.forEach(mesh => {
                scene.remove(mesh);
                mesh.dispose();
            });

            sharedGeometry.dispose();
            sharedMaterial.dispose();
            grassTexture.dispose();
        };

    } catch (e) {
        console.error("Grass generation failed", e);
    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};