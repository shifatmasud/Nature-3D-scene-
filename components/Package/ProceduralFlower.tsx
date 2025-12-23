
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Switched to named imports for Three.js members to correctly resolve types and avoid namespace property errors.
import { 
  CanvasTexture, 
  SRGBColorSpace, 
  Scene, 
  Camera, 
  Frustum, 
  Vector3, 
  Color, 
  CylinderGeometry, 
  PlaneGeometry, 
  MeshStandardMaterial, 
  DoubleSide, 
  InstancedMesh, 
  Object3D, 
  InstancedBufferAttribute 
} from 'three';
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
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, radius = size * 0.45;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.5, radius * 0.25, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};

export const createFlowers = (
    scene: Scene, 
    camera: Camera,
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const rng = mulberry32(13579);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number, frustum: Frustum) => {};

    try {
        const customUniforms = { uTime: { value: 0 }, uCameraPosition: { value: new Vector3() } };
        const flowersPerPatch = 12;
        const totalFlowers = positions.length * flowersPerPatch;

        const palette = [new Color(0xFFB7B2), new Color(0xE0BBE4), new Color(0xFFF4BD)];
        const stemGeo = new CylinderGeometry(0.0, 0.015, 1, 3); stemGeo.translate(0, 0.5, 0); 
        const headGeo = new PlaneGeometry(1, 1); headGeo.translate(0, 0.5, 0);
        const headTexture = createFlowerTexture();

        const ditherFunctions = `
            float bayer(vec2 v) { return ( ( 5.0 * v.x + 3.0 * v.y ) + ( 7.0 * v.x + 2.0 * v.y ) * ( 5.0 * v.x + 3.0 * v.y ) ) * 0.25; }
            float bayer(vec2 v, float rep) { v *= rep; return fract( bayer( floor(v) ) + bayer( fract(v) ) ); }
        `;

        const stemMaterial = new MeshStandardMaterial({ color: 0x558833, roughness: 1.0, metalness: 0.0 });
        stemMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uCameraPosition = customUniforms.uCameraPosition;
            shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform vec3 uCameraPosition;\nvarying float vDistToCam;\nfloat hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`);
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
                #include <begin_vertex>
                vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                vDistToCam = length(instanceWorldPos.xyz - uCameraPosition);
                float anim_lod_factor = 1.0 - smoothstep(2.0, 5.0, vDistToCam);
                float id = hash(vec2(instanceMatrix[3].x, instanceMatrix[3].z));
                transformed.x += sin(uTime * 1.5 + instanceMatrix[3].x * 0.5 + id * 10.0) * 0.1 * position.y * anim_lod_factor;
            `);
            shader.fragmentShader = `varying float vDistToCam;\n${ditherFunctions}\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
                #include <color_fragment>\nif (bayer(gl_FragCoord.xy, 4.0) > (1.0 - smoothstep(8.0, 12.0, vDistToCam))) discard;
            `);
        };
        
        const headMaterial = new MeshStandardMaterial({ map: headTexture, alphaTest: 0.1, side: DoubleSide, roughness: 1.0 });
        headMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime;\nattribute vec3 aFlowerInfo;\nvarying float vDistToCam;\nfloat hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`);
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
                vec3 instanceCenter_world = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                vDistToCam = length(cameraPosition - instanceCenter_world);
                vec3 look_world = normalize(cameraPosition - instanceCenter_world);
                vec3 right_world = normalize(cross(vec3(0.0, 1.0, 0.0), look_world));
                vec3 billboardUp_world = cross(look_world, right_world);
                vec3 finalPos_world = instanceCenter_world + right_world * position.x * aFlowerInfo.x + billboardUp_world * (position.y - 0.4) * aFlowerInfo.x;
                float anim_lod_factor = 1.0 - smoothstep(2.0, 5.0, vDistToCam);
                finalPos_world.x += sin(uTime * 1.5 + instanceCenter_world.x * 0.5 + hash(vec2(instanceCenter_world.x, instanceCenter_world.z)) * 10.0) * 0.1 * anim_lod_factor;
                vec3 transformed = (inverse(modelMatrix * instanceMatrix) * vec4(finalPos_world, 1.0)).xyz;
            `);
            shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>\nvNormal = normalize((viewMatrix * vec4(normalize(cameraPosition - (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz), 0.0)).xyz);`);
            shader.fragmentShader = `varying float vDistToCam;\n${ditherFunctions}\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
                if (texture2D(map, vMapUv).a < 0.5) discard;
                if (bayer(gl_FragCoord.xy, 4.0) > (1.0 - smoothstep(8.0, 12.0, vDistToCam))) discard;
            `);
        };
        
        const stemsMesh = new InstancedMesh(stemGeo, stemMaterial, totalFlowers);
        const headsMesh = new InstancedMesh(headGeo, headMaterial, totalFlowers);
        const flowerInfo = new Float32Array(totalFlowers * 3);
        const dummy = new Object3D();

        let idx = 0;
        for (let i = 0; i < positions.length; i++) {
            const p = positions[i], y = -1.5 + getGroundElevation(p.x, -p.z) * 0.3 - 0.05;
            for (let j = 0; j < flowersPerPatch; j++) {
                const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.6;
                const fx = p.x + Math.cos(angle) * r, fz = p.z + Math.sin(angle) * r;
                const scale = 0.8 + Math.random() * 0.4, h = 0.5 * scale, s = 0.3 * scale;
                dummy.position.set(fx, y, fz); dummy.scale.set(1, h, 1); dummy.updateMatrix();
                stemsMesh.setMatrixAt(idx, dummy.matrix);
                dummy.position.set(fx, y + h, fz); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
                headsMesh.setMatrixAt(idx, dummy.matrix);
                headsMesh.setColorAt(idx, palette[Math.floor(Math.random() * palette.length)]);
                flowerInfo[idx * 3] = s; idx++;
            }
        }

        headsMesh.geometry.setAttribute('aFlowerInfo', new InstancedBufferAttribute(flowerInfo, 3));
        scene.add(stemsMesh); scene.add(headsMesh);

        update = (time: number, _frustum: Frustum) => { 
            customUniforms.uTime.value = time; 
            customUniforms.uCameraPosition.value.copy(camera.position); 
        };
        cleanup = () => { scene.remove(stemsMesh); scene.remove(headsMesh); stemGeo.dispose(); headGeo.dispose(); stemMaterial.dispose(); headMaterial.dispose(); headTexture.dispose(); stemsMesh.dispose(); headsMesh.dispose(); };
    } catch (e) { console.error("Flower generation failed", e); }
    finally { Math.random = originalRandom; }
    return { update, cleanup };
};
