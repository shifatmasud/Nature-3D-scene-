/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Replaced named imports with a namespace import for Three.js to resolve module resolution errors.
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

const createFlowerTexture = () => {
  const size = 64; // Reduced texture size
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.45;

  ctx.save();
  ctx.translate(cx, cy);
  
  ctx.fillStyle = '#FFFFFF';
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    ctx.rotate((Math.PI * 2) / petals);
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.5, radius * 0.25, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// --- LOGIC ---

export const createFlowers = (
    scene: THREE.Scene, 
    camera: THREE.Camera,
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const seed = 13579;
    const rng = mulberry32(seed);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number, frustum: THREE.Frustum) => {};

    try {
        const customUniforms = { 
            uTime: { value: 0 },
            uCameraPosition: { value: new THREE.Vector3() }
        };
        const patchCount = positions.length;
        const flowersPerPatch = 12;

        const palette = [
            new THREE.Color(0xFFB7B2), // Pink
            new THREE.Color(0xE0BBE4), // Purple
            new THREE.Color(0xFFF4BD)  // Yellow
        ];

        // --- GEOMETRIES (SHARED) ---
        const stemGeo = new THREE.CylinderGeometry(0.0, 0.015, 1, 3);
        stemGeo.translate(0, 0.5, 0); 
        const headGeo = new THREE.PlaneGeometry(1, 1);
        headGeo.translate(0, 0.5, 0);
        const headTexture = createFlowerTexture();

        // --- DITHERING SHADER FRAGMENTS ---
        const ditherFunctions = `
            float bayer(vec2 v) {
                return ( ( 5.0 * v.x + 3.0 * v.y ) + ( 7.0 * v.x + 2.0 * v.y ) * ( 5.0 * v.x + 3.0 * v.y ) ) * 0.25;
            }
            float bayer(vec2 v, float rep) {
                v *= rep;
                return fract( bayer( floor(v) ) + bayer( fract(v) ) );
            }
        `;

        // --- MATERIALS (SHARED) ---
        const stemMaterial = new THREE.MeshStandardMaterial({
            color: 0x558833,
            roughness: 1.0,
            metalness: 0.0,
            transparent: false,
        });

        stemMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uCameraPosition = customUniforms.uCameraPosition;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform vec3 uCameraPosition;
                varying float vDistToCam;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                `
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                vDistToCam = length(instanceWorldPos.xyz - uCameraPosition);

                float anim_lod_start = 2.0;
                float anim_lod_end = 5.0;
                float anim_lod_factor = 1.0 - smoothstep(anim_lod_start, anim_lod_end, vDistToCam);
                
                float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
                float windPhase = uTime * 1.5 + instanceMatrix[3].x * 0.5;
                float sway = sin(windPhase + id * 10.0) * 0.1 * position.y;
                sway *= anim_lod_factor;
                transformed.x += sway;
                `
            );

            shader.fragmentShader = `
                varying float vDistToCam;
                ${ditherFunctions}
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                float fade_start = 8.0;
                float fade_end = 12.0;
                float fade_alpha = 1.0 - smoothstep(fade_start, fade_end, vDistToCam);
                
                float dither_val = bayer(gl_FragCoord.xy, 4.0);
                if (dither_val > fade_alpha) {
                    discard;
                }
                `
            );
        };
        
        const headMaterial = new THREE.MeshStandardMaterial({
            map: headTexture,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            roughness: 1.0,
            metalness: 0.0,
            transparent: false,
        });

        headMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                attribute vec3 aFlowerInfo; 
                varying float vDistToCam;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                `
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                vec3 instanceCenter_world = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                vDistToCam = length(cameraPosition - instanceCenter_world);

                vec3 look_world = normalize(cameraPosition - instanceCenter_world);
                vec3 right_world = normalize(cross(vec3(0.0, 1.0, 0.0), look_world));
                vec3 billboardUp_world = cross(look_world, right_world);

                float yOffset = -0.4;
                vec3 finalPos_world = instanceCenter_world 
                                    + right_world * position.x * aFlowerInfo.x 
                                    + billboardUp_world * (position.y + yOffset) * aFlowerInfo.x;

                float anim_lod_start = 2.0;
                float anim_lod_end = 5.0;
                float anim_lod_factor = 1.0 - smoothstep(anim_lod_start, anim_lod_end, vDistToCam);

                float id = hash(vec2(instanceCenter_world.x, instanceCenter_world.z));
                float windPhase = uTime * 1.5 + instanceCenter_world.x * 0.5;
                float sway = sin(windPhase + id * 10.0) * 0.1;
                sway *= anim_lod_factor;
                finalPos_world.x += sway;

                vec4 finalPos_local = inverse(modelMatrix * instanceMatrix) * vec4(finalPos_world, 1.0);
                vec3 transformed = finalPos_local.xyz;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <defaultnormal_vertex>',
                `
                #include <defaultnormal_vertex>
                vec3 billboard_center_world = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                vec3 worldNormal = normalize(cameraPosition - billboard_center_world);
                vec3 viewNormal = normalize((viewMatrix * vec4(worldNormal, 0.0)).xyz);
                vNormal = viewNormal;
                `
            );
            
            shader.fragmentShader = `
                varying float vDistToCam;
                ${ditherFunctions}
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <alphatest_fragment>',
                `
                float fade_start = 8.0;
                float fade_end = 12.0;
                float fade_alpha = 1.0 - smoothstep(fade_start, fade_end, vDistToCam);
                
                if (texture2D(map, vMapUv).a < 0.5) discard;

                float dither_val = bayer(gl_FragCoord.xy, 4.0);
                if (dither_val > fade_alpha) {
                    discard;
                }
                `
            );
        };
        
        type FlowerInstance = { stemMatrix: THREE.Matrix4, headMatrix: THREE.Matrix4, headColor: THREE.Color, info: {x: number, y: number, z: number}, sortKey: number };
        type ManagedPatch = { stemsMesh: THREE.InstancedMesh, headsMesh: THREE.InstancedMesh, center: THREE.Vector3, boundingSphere: THREE.Sphere };
        const managedPatches: ManagedPatch[] = [];
        
        const patchRadius = 0.6;

        for (let i = 0; i < patchCount; i++) {
            const patchPos = positions[i];
            const gElev = getGroundElevation(patchPos.x, -patchPos.z) * 0.3;
            const patchY = -1.5 + gElev - 0.05;
            const patchCenter = new THREE.Vector3(patchPos.x, patchY, patchPos.z);
            const boundingSphere = new THREE.Sphere(patchCenter, patchRadius + 0.5);
            
            const tempFlowers: FlowerInstance[] = [];

            for(let j=0; j<flowersPerPatch; j++) {
                const anglePos = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * patchRadius;
                const flowerX = patchPos.x + Math.cos(anglePos) * r;
                const flowerZ = patchPos.z + Math.sin(anglePos) * r;

                const scale = 0.8 + Math.random() * 0.4;
                const stemHeight = 0.5 * scale;
                const headSize = 0.3 * scale;

                const stemDummy = new THREE.Object3D();
                stemDummy.position.set(flowerX, patchY, flowerZ);
                stemDummy.scale.set(1, stemHeight, 1);
                stemDummy.updateMatrix();
                
                const headDummy = new THREE.Object3D();
                headDummy.position.set(flowerX, patchY + stemHeight, flowerZ);
                headDummy.updateMatrix();

                tempFlowers.push({
                    stemMatrix: stemDummy.matrix.clone(),
                    headMatrix: headDummy.matrix.clone(),
                    headColor: palette[Math.floor(Math.random() * palette.length)],
                    info: { x: headSize, y: stemHeight, z: Math.random() * 100 },
                    sortKey: Math.random()
                });
            }
            
            tempFlowers.sort((a,b) => a.sortKey - b.sortKey);
            
            const stemsMesh = new THREE.InstancedMesh(stemGeo, stemMaterial, flowersPerPatch);
            const headsMesh = new THREE.InstancedMesh(headGeo, headMaterial, flowersPerPatch);
            const flowerInfo = new Float32Array(flowersPerPatch * 3);
            
            for(let j=0; j<flowersPerPatch; j++) {
                const flower = tempFlowers[j];
                stemsMesh.setMatrixAt(j, flower.stemMatrix);
                headsMesh.setMatrixAt(j, flower.headMatrix);
                headsMesh.setColorAt(j, flower.headColor);
                flowerInfo[j * 3 + 0] = flower.info.x;
                flowerInfo[j * 3 + 1] = flower.info.y;
                flowerInfo[j * 3 + 2] = flower.info.z;
            }

            headsMesh.geometry.setAttribute('aFlowerInfo', new THREE.InstancedBufferAttribute(flowerInfo, 3));
            stemsMesh.castShadow = false;
            stemsMesh.receiveShadow = false;
            headsMesh.castShadow = false;
            headsMesh.receiveShadow = false;

            scene.add(stemsMesh);
            scene.add(headsMesh);
            managedPatches.push({stemsMesh, headsMesh, center: patchCenter, boundingSphere });
        }
        
        const CULL_DIST = 15.0;
        
        update = (time: number, frustum: THREE.Frustum) => {
            customUniforms.uTime.value = time;
            customUniforms.uCameraPosition.value.copy(camera.position);

            for (const patch of managedPatches) {
                if (!frustum.intersectsSphere(patch.boundingSphere)) {
                    patch.stemsMesh.visible = false;
                    patch.headsMesh.visible = false;
                    continue;
                }

                const dist = camera.position.distanceTo(patch.center);
                const isVisible = dist <= CULL_DIST;
                
                patch.stemsMesh.visible = isVisible;
                patch.headsMesh.visible = isVisible;
            }
        };

        cleanup = () => {
            for(const patch of managedPatches) {
                scene.remove(patch.stemsMesh);
                scene.remove(patch.headsMesh);
                patch.stemsMesh.dispose();
                patch.headsMesh.dispose();
            }
            stemGeo.dispose();
            headGeo.dispose();
            stemMaterial.dispose();
            headMaterial.dispose();
            headTexture.dispose();
        };

    } catch (e) {
        console.error("Flower generation failed", e);
    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};