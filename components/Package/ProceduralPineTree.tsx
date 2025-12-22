/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Replaced wildcard import with named imports for Three.js to resolve type errors.
import { CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter, Scene, Camera, Frustum, Vector3, CylinderGeometry, PlaneGeometry, MeshStandardMaterial, DoubleSide, Matrix4, Color, Object3D, InstancedMesh } from 'three';
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

const createFriendlyPineTexture = () => {
  const size = 64;
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

  ctx.beginPath();
  ctx.moveTo(cx - 2, bottom);
  ctx.lineTo(cx + 2, bottom);
  ctx.lineTo(cx, top);
  ctx.fill();

  const rows = 12;
  for(let i = 0; i <= rows; i++) {
      const t = i / rows;
      const y = bottom - (t * height);
      const width = (size * 0.45) * (1.0 - t * 0.6);
      const angle = 0.2 - t * 0.4;
      const needleLen = width * (0.8 + Math.random() * 0.4);
      const thickness = (size * 0.08) * (1.0 - t * 0.5);

      ctx.save();
      ctx.translate(cx, y);
      ctx.rotate(-1.5 - angle);
      ctx.beginPath();
      ctx.ellipse(needleLen/2, 0, needleLen/2, thickness/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, y);
      ctx.rotate(1.5 + angle);
      ctx.beginPath();
      ctx.ellipse(needleLen/2, 0, needleLen/2, thickness/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      
      if(i % 2 === 0) {
        ctx.save();
        ctx.translate(cx, y);
        ctx.beginPath();
        ctx.ellipse(0, 0, thickness, thickness*1.5, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
  }

  ctx.beginPath();
  ctx.arc(cx, top, size * 0.06, 0, Math.PI*2);
  ctx.fill();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
};

// --- LOGIC ---

export const createPineTrees = (
    scene: Scene, 
    camera: Camera, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const seed = 334455; 
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
        const woodGeo = new CylinderGeometry(0.0, 0.4, 1, 5);
        woodGeo.translate(0, 0.5, 0);

        const leafGeo = new PlaneGeometry(1, 1);
        leafGeo.translate(0, 0.5, 0); 

        // MATERIALS
        const trunkMaterial = new MeshStandardMaterial({
            color: 0xBEB28D, 
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

                float windSway = sin(uTime * 0.5 + instanceMatrix[3].x * 0.3) * 0.02;
                windSway *= anim_lod_factor;
                float bend = windSway * (position.y * position.y * 0.03); 
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

        const boughTexture = createFriendlyPineTexture();
        const leafMaterial = new MeshStandardMaterial({
            map: boughTexture,
            alphaTest: 0.1, 
            side: DoubleSide,
            roughness: 1.0, 
            metalness: 0.0,
            color: 0xffffff,
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
                
                vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                vDistToCam = length(instanceWorldPos.xyz - uCameraPosition);

                float anim_lod_start = 3.0;
                float anim_lod_end = 6.0;
                float anim_lod_factor = 1.0 - smoothstep(anim_lod_start, anim_lod_end, vDistToCam);

                float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
                float windPhase = uTime * 0.8 + instanceMatrix[3].x * 0.5;
                
                float sway = sin(windPhase + id * 5.0) * 0.1 * uv.y;
                float flutter = sin(windPhase * 3.0 + uv.x * 5.0) * 0.03 * uv.y;
                
                sway *= anim_lod_factor;
                flutter *= anim_lod_factor;

                transformed.x += sway;
                transformed.z += flutter;
                `
            );
            
            shader.fragmentShader = `
                varying float vDistToCam;
                 ${ditherFunctions}
            ` + shader.fragmentShader;

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
        
        for (let i = 0; i < count; i++) {
            const p = positions[i];
            const gElev = getGroundElevation(p.x, -p.z) * 0.3;
            const treeY = -1.5 + gElev - 0.2;
            const treeBase = new Vector3(p.x, treeY, p.z);
            
            const trunkHeight = 7.5 + Math.random() * 2.0; 
            const trunkWidth = 0.4 + Math.random() * 0.1;
            
            const dummyWood = new Object3D();
            dummyWood.position.copy(treeBase);
            dummyWood.rotation.set((Math.random()-0.5)*0.05, Math.random()*Math.PI, (Math.random()-0.5)*0.05);
            dummyWood.scale.set(trunkWidth, trunkHeight, trunkWidth);
            dummyWood.updateMatrix();
            allWoodMatrices.push(dummyWood.matrix.clone());

            const trunkMatrix = dummyWood.matrix.clone();
            const trunkQuat = dummyWood.quaternion.clone();
            
            const layers = 20;
            const branchesPerLayer = 8;

            for (let l = 0; l < layers; l++) {
                const t = l / (layers - 1);
                const startH = 0.95;
                const endH = 0.25;
                const baseHRatio = startH - (t * (startH - endH)); 
                const coneRadius = 0.2 + (t * 1.8);

                for(let b=0; b<branchesPerLayer; b++) {
                    const hJitter = (Math.random() - 0.5) * 0.04;
                    const hRatio = baseHRatio + hJitter;
                    const angle = (b / branchesPerLayer) * Math.PI * 2 + (l * 2.5);
                    const branchLen = coneRadius * (0.8 + Math.random() * 0.4);
                    const droop = 0.5 + (t * 0.4); 
                    
                    const _start = new Vector3(0, hRatio, 0).applyMatrix4(trunkMatrix);
                    
                    const dx = Math.cos(angle) * branchLen;
                    const dz = Math.sin(angle) * branchLen;
                    const dy = -Math.sin(droop) * branchLen;
                    const _end = new Vector3(dx, dy, dz).applyQuaternion(trunkQuat).add(_start);
                    
                    const dummy = new Object3D();
                    dummy.position.copy(_start);
                    dummy.lookAt(_end);
                    dummy.rotateX(Math.PI / 2); 
                    dummy.rotateY(Math.random() * Math.PI * 2);
                    
                    const s = branchLen * 1.5;
                    dummy.scale.set(s, s, s);
                    dummy.updateMatrix();

                    const color = new Color();
                    const v = Math.random();
                    if(v > 0.7) color.setHex(0xB2D8B2);      
                    else if(v > 0.3) color.setHex(0x88C488); 
                    else color.setHex(0x66A566);             
                    color.offsetHSL(0, 0, (Math.random()-0.5)*0.05);
                    
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
        };

        cleanup = () => {
            scene.remove(woodMesh);
            scene.remove(leafMesh);
            woodGeo.dispose();
            leafGeo.dispose();
            trunkMaterial.dispose();
            leafMaterial.dispose();
            boughTexture.dispose();
            woodMesh.dispose();
            leafMesh.dispose();
        };
    } catch (e) {
        console.error("Pine tree generation failed", e);
    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};