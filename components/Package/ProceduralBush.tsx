
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Switched to named imports for Three.js members to ensure correct type mapping and property access.
import { 
  CanvasTexture, 
  SRGBColorSpace, 
  Scene, 
  Camera, 
  Frustum, 
  Vector3, 
  IcosahedronGeometry, 
  Mesh, 
  PlaneGeometry, 
  MeshStandardMaterial, 
  DoubleSide, 
  InstancedMesh, 
  Object3D, 
  Color 
} from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
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

  for(let i=0; i<20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.25);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.08) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*0.5 - 0.25));
  }

  for(let i=0; i<20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.15); 
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.06) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, angle - Math.PI/2 + (Math.random()*1.0 - 0.5));
  }

  for(let i=0; i<10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (size * 0.05);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const len = (size * 0.05) * (0.8 + Math.random() * 0.4);
    drawLeaf(x, y, len, Math.random() * Math.PI * 2);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace; 
  return tex;
};

// --- LOGIC ---

export const createBushes = (
    scene: Scene, 
    camera: Camera, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const rng = mulberry32(123456);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number, frustum: Frustum) => {};

    try {
        const customUniforms = { 
          uTime: { value: 0 },
          uCameraPosition: { value: new Vector3() } 
        };
        
        const baseRadius = 0.3; 
        const baseGeo = new IcosahedronGeometry(baseRadius, 0);
        const sampler = new MeshSurfaceSampler(new Mesh(baseGeo)).build();
        const planeGeo = new PlaneGeometry(1, 1, 1, 1);

        const clusterTexture = createDenseClusterTexture();
        const material = new MeshStandardMaterial({
          map: clusterTexture,
          alphaTest: 0.1, 
          side: DoubleSide,
          roughness: 0.9, 
          metalness: 0.0,
          transparent: false,
        });

        material.onBeforeCompile = (shader) => {
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
            float isZFacing = step(0.9, abs(normal.z));
            float dist = length(uv - 0.5);
            transformed.z -= dist * dist * 1.0 * isZFacing;
            
            float anim_lod_start = 2.0;
            float anim_lod_end = 5.0;
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
             float bayer(vec2 v) {
                return ( ( 5.0 * v.x + 3.0 * v.y ) + ( 7.0 * v.x + 2.0 * v.y ) * ( 5.0 * v.x + 3.0 * v.y ) ) * 0.25;
            }
            float bayer(vec2 v, float rep) {
                v *= rep;
                return fract( bayer( floor(v) ) + bayer( fract(v) ) );
            }
          ` + shader.fragmentShader;

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>
            float planeGradient = mix(0.5, 1.1, vMapUv.y); 
            diffuseColor.rgb *= planeGradient;
            `
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <alphatest_fragment>',
            `
            float fade_start = 22.0;
            float fade_end = 25.0;
            float fade_alpha = 1.0 - smoothstep(fade_start, fade_end, vDistToCam);
            
            if (texture2D(map, vMapUv).a < 0.5) discard;

            float dither_val = bayer(gl_FragCoord.xy, 4.0);
            if (dither_val > fade_alpha) {
                discard;
            }
            `
          );
        };

        const leavesPerBush = 200; 
        const totalLeaves = positions.length * leavesPerBush;
        const globalMesh = new InstancedMesh(planeGeo, material, totalLeaves);
        globalMesh.castShadow = false;
        globalMesh.receiveShadow = false;

        const dummy = new Object3D();
        const upVector = new Vector3(0, 1, 0);
        const _pos = new Vector3();
        const _norm = new Vector3();

        let leafIdx = 0;
        for (let i = 0; i < positions.length; i++) {
            const structureScale = 4.0 + Math.random() * 3.0; 
            const visualRadius = baseRadius * structureScale;
            
            const p = positions[i];
            const displacementScale = 0.3;
            const groundHeight = getGroundElevation(p.x, -p.z) * displacementScale;
            const centerY = -1.5 + groundHeight + visualRadius - 0.05;
            const center = new Vector3(p.x, centerY, p.z);

            for (let j = 0; j < leavesPerBush; j++) {
                sampler.sample(_pos, _norm);
                const leafOffset = _pos.clone().normalize().multiplyScalar(visualRadius);
                const noise = (Math.random() - 0.5) * 0.4;
                leafOffset.add(_norm.clone().multiplyScalar(noise));
                const leafPos = center.clone().add(leafOffset);
                
                _norm.lerp(upVector, 0.5).normalize();
                dummy.position.copy(leafPos);
                dummy.lookAt(leafPos.clone().add(_norm));
                dummy.rotateZ(Math.random() * Math.PI * 2);

                const leafScaleBase = 2.5; 
                const s = (0.8 + Math.random() * 0.6) * leafScaleBase; 
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();

                const tempColor = new Color();
                const v = Math.random();
                if(v > 0.7) tempColor.setHex(0xB2D8B2); 
                else if(v > 0.3) tempColor.setHex(0x88C488); 
                else tempColor.setHex(0x66A566);
                if (Math.random() > 0.5) tempColor.offsetHSL(0, 0, 0.05);

                globalMesh.setMatrixAt(leafIdx, dummy.matrix);
                globalMesh.setColorAt(leafIdx, tempColor);
                leafIdx++;
            }
        }
        
        scene.add(globalMesh);
        
        update = (time: number, _frustum: Frustum) => {
            customUniforms.uTime.value = time;
            customUniforms.uCameraPosition.value.copy(camera.position);
        };

        cleanup = () => {
            scene.remove(globalMesh);
            planeGeo.dispose();
            baseGeo.dispose();
            clusterTexture.dispose();
            material.dispose();
            globalMesh.dispose();
        };
    } catch (e) {
        console.error("Bush generation failed", e);
    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};
