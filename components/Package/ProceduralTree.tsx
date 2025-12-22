/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Replaced wildcard import with named imports for Three.js to resolve type errors.
import { Vector3, CanvasTexture, SRGBColorSpace, Scene, Camera, Frustum, CylinderGeometry, PlaneGeometry, MeshStandardMaterial, DoubleSide, Matrix4, Color, Object3D, InstancedMesh } from 'three';
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

const randomInSphere = (radius: number, center: Vector3, target: Vector3) => {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(Math.random()) * radius;
    const sinPhi = Math.sin(phi);
    target.x = center.x + r * sinPhi * Math.cos(theta);
    target.y = center.y + r * sinPhi * Math.sin(theta);
    target.z = center.z + r * Math.cos(phi);
};

const createDenseClusterTexture = () => {
  const size = 32;
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

  for(let i=0; i<24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.28);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.09) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*0.5 - 0.25));
  }
  for(let i=0; i<18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.18); 
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.07) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*1.0 - 0.5));
  }
  for(let i=0; i<12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.06);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.06) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, Math.random() * Math.PI * 2);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace; 
  return tex;
};

// --- LOGIC ---

export const createTrees = (
    scene: Scene, 
    camera: Camera, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const seed = 987654; 
    const rng = mulberry32(seed);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number, frustum: Frustum) => {};

    try {
        const customUniforms = { 
            uTime: { value: 0 },
            uCameraPosition: { value: new Vector3() } 
        };
        const count = positions.length;
        
         const ditherFunctions = `
            float bayer(vec2 v) {
                return ( ( 5.0 * v.x + 3.0 * v.y ) + ( 7.0 * v.x + 2.0 * v.y ) * ( 5.0 * v.x + 3.0 * v.y ) ) * 0.25;
            }
            float bayer(vec2 v, float rep) {
                v *= rep;
                return fract( bayer( floor(v) ) + bayer( fract(v) ) );
            }
        `;

        // GEOMETRY
        const woodGeo = new CylinderGeometry(0.3, 1.0, 1, 3);
        woodGeo.translate(0, 0.5, 0); 

        const leafGeo = new PlaneGeometry(1, 1, 1, 1);

        // MATERIALS
        const trunkMaterial = new MeshStandardMaterial({
            color: 0x8D7B68, 
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true,
            transparent: false,
        });

        trunkMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uCameraPosition = customUniforms.uCameraPosition;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform vec3 uCameraPosition;
                varying float vDistToCam;
                `
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                vDistToCam = length(instanceWorldPos.xyz - uCameraPosition);

                float anim_lod_start = 3.0;
                float anim_lod_end = 6.0;
                float anim_lod_factor = 1.0 - smoothstep(anim_lod_start, anim_lod_end, vDistToCam);

                float windSway = sin(uTime * 0.5 + instanceMatrix[3].x * 0.3) * 0.05;
                windSway *= anim_lod_factor;
                float bend = windSway * (position.y * position.y * 0.04); 
                transformed.x += bend;
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
                float fade_start = 22.0;
                float fade_end = 28.0;
                float fade_alpha = 1.0 - smoothstep(fade_start, fade_end, vDistToCam);
                
                float dither_val = bayer(gl_FragCoord.xy, 4.0);
                if (dither_val > fade_alpha) {
                    discard;
                }
                `
            );
        };

        const clusterTexture = createDenseClusterTexture();
        const leafMaterial = new MeshStandardMaterial({
            map: clusterTexture,
            alphaTest: 0.1, 
            side: DoubleSide,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: false,
            transparent: false,
        });

        leafMaterial.onBeforeCompile = (shader) => {
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

                float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
                float dist = length(uv - 0.5);
                transformed.z -= dist * dist * 1.5 * step(0.9, abs(normal.z));
                
                float anim_lod_start = 3.0;
                float anim_lod_end = 6.0;
                float anim_lod_factor = 1.0 - smoothstep(anim_lod_start, anim_lod_end, vDistToCam);

                float windPhase = uTime * 0.8 + instanceMatrix[3].x * 0.5;
                float windSway = sin(windPhase);
                float windFlutter = sin(windPhase * 2.5 + id * 5.0) * 0.15;
                float windOffset = (windSway + windFlutter) * uv.y * 0.05 * anim_lod_factor;
                
                transformed.x += windOffset; 
                transformed.z += windOffset * 0.3; 
                transformed.y += sin(windPhase * 1.5) * uv.y * 0.02 * anim_lod_factor; 
                `
            );
            
            shader.fragmentShader = `
                varying float vDistToCam;
                ${ditherFunctions}
            ` + shader.fragmentShader;
            
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>\nfloat planeGradient = mix(0.6, 1.1, vMapUv.y); diffuseColor.rgb *= planeGradient;`
            );
            
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <alphatest_fragment>',
                `
                float fade_start = 22.0;
                float fade_end = 28.0;
                float fade_alpha = 1.0 - smoothstep(fade_start, fade_end, vDistToCam);

                if (texture2D(map, vMapUv).a < 0.5) discard;
                
                float dither_val = bayer(gl_FragCoord.xy, 4.0);
                if (dither_val > fade_alpha) {
                    discard;
                }
                `
            );
        };
        
        type LeafInstance = { matrix: Matrix4, color: Color };
        
        const allWoodMatrices: Matrix4[] = [];
        const allLeafInstances: LeafInstance[] = [];
        
        const _pos = new Vector3();
        const _target = new Vector3();
        const upVector = new Vector3(0, 1, 0);
        const dummy = new Object3D();

        for (let i = 0; i < count; i++) {
            const p = positions[i];
            const gElev = getGroundElevation(p.x, -p.z) * 0.3;
            const treeY = -1.5 + gElev - 0.2;
            const treeBase = new Vector3(p.x, treeY, p.z);
            
            const trunkHeight = 4.5 + Math.random() * 2.0;
            const trunkWidth = 0.25 + Math.random() * 0.1;

            dummy.position.copy(treeBase);
            dummy.rotation.set((Math.random()-0.5)*0.1, Math.random()*Math.PI, (Math.random()-0.5)*0.1);
            dummy.scale.set(trunkWidth, trunkHeight, trunkWidth);
            dummy.updateMatrix();
            const trunkMatrix = dummy.matrix.clone();
            const trunkTop = new Vector3(0, 1, 0).applyMatrix4(trunkMatrix);

            const branchesPerTree = 15; 
            const branchTips: Vector3[] = [trunkTop];
            allWoodMatrices.push(trunkMatrix);

            for (let b = 0; b < branchesPerTree; b++) {
                const hRatio = 0.5 + 0.45 * (b / (branchesPerTree - 1)) + (Math.random() * 0.1);
                const attachPoint = new Vector3(0, hRatio, 0).applyMatrix4(trunkMatrix);
                
                const angle = b * 2.4 + Math.random() * 0.5; 
                const leanUp = 0.5 + Math.random() * 0.4;
                const branchLen = (trunkHeight * 0.35) * (1.0 - hRatio * 0.5);
                const branchWidth = trunkWidth * 0.6 * (1.0 - hRatio * 0.4);

                dummy.position.copy(attachPoint);
                dummy.rotation.set(0, angle, 0); 
                dummy.rotateX(leanUp); 
                dummy.rotateZ((Math.random()-0.5)*0.2); 
                dummy.scale.set(branchWidth, branchLen, branchWidth);
                dummy.updateMatrix();
                allWoodMatrices.push(dummy.matrix.clone());
                branchTips.push(new Vector3(0, 1, 0).applyMatrix4(dummy.matrix));
            }

            const leavesPerCluster = 300; 
            for (const tip of branchTips) {
                const clusterRadius = 1.4 + Math.random() * 0.8;
                for (let l = 0; l < leavesPerCluster; l++) {
                    randomInSphere(clusterRadius, tip, _target);
                    dummy.position.copy(_target);
                    _pos.subVectors(_target, tip).normalize().lerp(upVector, 0.6).normalize(); 
                    dummy.lookAt(_target.clone().add(_pos));
                    dummy.rotateZ(Math.random() * Math.PI * 2);
                    const dist = _target.distanceTo(tip);
                    const scaleFalloff = 1.0 - (dist / clusterRadius) * 0.5;
                    const s = (1.8 + Math.random() * 1.0) * scaleFalloff;
                    dummy.scale.set(s, s, s);
                    dummy.updateMatrix();
                    const color = new Color();
                    const v = Math.random();
                    if (v > 0.75) color.setHex(0xB2D8B2); 
                    else if (v > 0.35) color.setHex(0x88C488); 
                    else color.setHex(0x66A566);
                    color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
                    allLeafInstances.push({ matrix: dummy.matrix.clone(), color });
                }
            }
        }
        
        const woodMesh = new InstancedMesh(woodGeo, trunkMaterial, allWoodMatrices.length);
        allWoodMatrices.forEach((m, i) => woodMesh.setMatrixAt(i, m));
        woodMesh.castShadow = false;
        woodMesh.receiveShadow = false;
        scene.add(woodMesh);

        // --- SORT FOR LOD ---
        const tempPos = new Vector3();
        allLeafInstances.sort((a, b) => {
            const distA = tempPos.setFromMatrixPosition(a.matrix).lengthSq();
            const distB = tempPos.setFromMatrixPosition(b.matrix).lengthSq();
            return distA - distB;
        });

        const leafMesh = new InstancedMesh(leafGeo, leafMaterial, allLeafInstances.length);
        allLeafInstances.forEach((inst, i) => {
            leafMesh.setMatrixAt(i, inst.matrix);
            leafMesh.setColorAt(i, inst.color);
        });
        leafMesh.castShadow = false;
        leafMesh.receiveShadow = false;
        scene.add(leafMesh);
        
        update = (time: number, frustum: Frustum) => {
            customUniforms.uTime.value = time;
            customUniforms.uCameraPosition.value.copy(camera.position);

            // Geometry LOD (reducing instance count) has been removed.
            // LOD is now handled exclusively by animation fading in the vertex shader.
        };

        cleanup = () => {
            scene.remove(woodMesh);
            scene.remove(leafMesh);
            woodGeo.dispose();
            leafGeo.dispose();
            trunkMaterial.dispose();
            leafMaterial.dispose();
            clusterTexture.dispose();
            woodMesh.dispose();
            leafMesh.dispose();
        };
    } catch (e) {
        console.error("Tree generation failed", e);
    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};