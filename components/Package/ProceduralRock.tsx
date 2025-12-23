
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Switched to named imports for Three.js members to correctly resolve types and avoid namespace property errors.
import { 
  Scene, 
  Frustum, 
  Vector3, 
  Color, 
  IcosahedronGeometry, 
  MeshStandardMaterial, 
  InstancedMesh, 
  Object3D, 
  PerspectiveCamera 
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

// --- LOGIC ---

export const createRocks = (
    scene: Scene, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    const originalRandom = Math.random;
    const seed = 246810; 
    const rng = mulberry32(seed);
    Math.random = rng;

    let cleanup = () => {};
    let update = (time: number, frustum: Frustum) => {};

    try {
        const customUniforms = { 
            uTime: { value: 0 },
            uCameraPosition: { value: new Vector3() },
            uMossColor: { value: new Color(0x669966) },
            uRockColor: { value: new Color(0x9E9E9E) }
        };
        const count = positions.length;

        const geometry = new IcosahedronGeometry(1.0, 1);
        const material = new MeshStandardMaterial({
            color: 0x9E9E9E,
            roughness: 0.8,
            metalness: 0.1,
        });

        const ditherFunctions = `
            float bayer(vec2 v) {
                return ( ( 5.0 * v.x + 3.0 * v.y ) + ( 7.0 * v.x + 2.0 * v.y ) * ( 5.0 * v.x + 3.0 * v.y ) ) * 0.25;
            }
            float bayer(vec2 v, float rep) {
                v *= rep;
                return fract( bayer( floor(v) ) + bayer( fract(v) ) );
            }
        `;

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uCameraPosition = customUniforms.uCameraPosition;
            shader.uniforms.uMossColor = customUniforms.uMossColor;
            shader.uniforms.uRockColor = customUniforms.uRockColor;
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                varying vec3 vWorldPosition;
                varying float vDistToCam;
                uniform vec3 uCameraPosition;

                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                
                float noise(vec3 x) {
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    f = f * f * (3.0 - 2.0 * f);
                    
                    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
                }

                float fbm(vec3 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    for (int i = 0; i < 3; i++) {
                        value += amplitude * noise(p);
                        p *= 2.0;
                        amplitude *= 0.5;
                    }
                    return value;
                }
                `
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                vDistToCam = length(instanceWorldPos.xyz - uCameraPosition);
                
                float lod_start = 8.0;
                float lod_end = 20.0;
                float lod_factor = 1.0 - smoothstep(lod_start, lod_end, vDistToCam);
                lod_factor = max(0.1, lod_factor); // Keep a little bit of shape

                vec3 instancePos = instanceWorldPos.xyz;
                
                float warp = fbm(position * 0.5 + instancePos.x * 0.1);
                vec3 warpedPos = position + normal * warp * 0.5 * lod_factor;

                float detail = fbm(warpedPos * 3.0 + instancePos.z * 0.1) * 0.3 * lod_factor;
                
                transformed += normal * detail;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                `
            );

            shader.fragmentShader = `
                varying vec3 vWorldPosition;
                varying float vDistToCam;
                uniform vec3 uMossColor;
                uniform vec3 uRockColor;
                ${ditherFunctions}
                
                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise(vec3 x) {
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
                }
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                vec3 worldNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
                
                float mineralNoise = noise(vWorldPosition * 2.0);
                vec3 baseColor = mix(uRockColor, uRockColor * 0.8, mineralNoise);

                float mossFactor = smoothstep(0.4, 0.7, worldNormal.y);
                
                float mossNoise = noise(vWorldPosition * 5.0);
                mossFactor *= smoothstep(0.3, 0.7, mossNoise);

                vec3 finalColor = mix(baseColor, uMossColor, mossFactor);
                
                diffuseColor.rgb = finalColor;

                // --- DITHERED FADE ---
                float fade_start = 20.0;
                float fade_end = 25.0;
                float fade_alpha = 1.0 - smoothstep(fade_start, fade_end, vDistToCam);

                float dither_val = bayer(gl_FragCoord.xy, 4.0);
                if (dither_val > fade_alpha) {
                    discard;
                }
                `
            );
        };

        const mesh = new InstancedMesh(geometry, material, count);
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        const dummy = new Object3D();
        
        for (let i = 0; i < count; i++) {
            const p = positions[i];
            
            const baseScale = 2.0 + Math.random() * 1.5;
            const stretchX = 1.0 + (Math.random() - 0.5) * 0.8;
            const stretchY = 0.8 + (Math.random() - 0.5) * 0.6;
            const stretchZ = 1.0 + (Math.random() - 0.5) * 0.8;
            const scaleX = baseScale * stretchX;
            const scaleY = baseScale * stretchY;
            const scaleZ = baseScale * stretchZ;

            const groundHeight = getGroundElevation(p.x, -p.z) * 0.3;
            const y = -1.5 + groundHeight - (scaleY * 0.3); 

            dummy.position.set(p.x, y, p.z);
            dummy.scale.set(scaleX, scaleY, scaleZ);
            
            dummy.rotation.set(
                (Math.random() - 0.5) * 0.2,
                Math.random() * Math.PI * 2, 
                (Math.random() - 0.5) * 0.2
            );
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        scene.add(mesh);

        update = (time: number, frustum: Frustum) => {
            customUniforms.uTime.value = time;
            const camera = scene.getObjectByProperty("isPerspectiveCamera", true) as PerspectiveCamera;
            if (camera) {
                customUniforms.uCameraPosition.value.copy(camera.position);
            }
        };

        cleanup = () => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            mesh.dispose();
        };

    } catch (e) {
        console.error("Rock generation failed", e);
    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};
