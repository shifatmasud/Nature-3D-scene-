

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';
import { getGroundElevation } from './Ground.tsx';

// --- LOGIC ---

export const createRocks = (
    scene: THREE.Scene, 
    theme: any, 
    positions: {x: number, z: number}[]
) => {
    let cleanup = () => {};
    let update = (time: number) => {};

    try {
        const customUniforms = { 
            uTime: { value: 0 },
            uMossColor: { value: new THREE.Color(0x669966) }, // Soft green moss
            uRockColor: { value: new THREE.Color(0x9E9E9E) } // Neutral grey stone
        };
        const count = positions.length;

        // GEOMETRY: Icosahedron for a more rounded, detailed base shape.
        // Subdivision level 1 provides a good balance of detail and performance.
        const geometry = new THREE.IcosahedronGeometry(1.0, 1);

        // MATERIAL: Smooth shading with procedural texturing for a more natural look.
        const material = new THREE.MeshStandardMaterial({
            color: 0x9E9E9E, // Base color, will be modulated in shader
            roughness: 0.8,
            metalness: 0.1,
            // flatShading: false, is the default
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uMossColor = customUniforms.uMossColor;
            shader.uniforms.uRockColor = customUniforms.uRockColor;
            
            // Inject varyings and noise functions
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                varying vec3 vWorldPosition;

                // Psuedo-random number generator
                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                
                // Simplex-like noise function
                float noise(vec3 x) {
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    f = f * f * (3.0 - 2.0 * f);
                    
                    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
                }

                // Fractional Brownian Motion (fBm) for more detailed noise
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
                
                // --- PROCEDURAL DISPLACEMENT ---
                vec3 instancePos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                
                float warp = fbm(position * 0.5 + instancePos.x * 0.1);
                vec3 warpedPos = position + normal * warp * 0.5;

                float detail = fbm(warpedPos * 3.0 + instancePos.z * 0.1) * 0.3;
                
                transformed += normal * detail;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                // Manually calculate world position to pass to the fragment shader.
                // This is more robust than relying on the conditionally-defined 'worldPosition' variable.
                vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                `
            );

            shader.fragmentShader = `
                varying vec3 vWorldPosition;
                uniform vec3 uMossColor;
                uniform vec3 uRockColor;
                
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
                `
            );
        };

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < count; i++) {
            const p = positions[i];
            
            // Scale: Make them feel large and heavy
            const baseScale = 2.0 + Math.random() * 1.5;
            const stretchX = 1.0 + (Math.random() - 0.5) * 0.8;
            const stretchY = 0.8 + (Math.random() - 0.5) * 0.6;
            const stretchZ = 1.0 + (Math.random() - 0.5) * 0.8;
            const scaleX = baseScale * stretchX;
            const scaleY = baseScale * stretchY;
            const scaleZ = baseScale * stretchZ;

            // Placement: Settle into the ground naturally
            const groundHeight = getGroundElevation(p.x, p.z) * 0.3;
            // Sink rocks into the ground by about 30% of their height
            const y = -1.5 + groundHeight - (scaleY * 0.3); 

            dummy.position.set(p.x, y, p.z);
            dummy.scale.set(scaleX, scaleY, scaleZ);
            
            // Random, but natural-looking rotation
            dummy.rotation.set(
                (Math.random() - 0.5) * 0.2, // Slight tilt forward/back
                Math.random() * Math.PI * 2, 
                (Math.random() - 0.5) * 0.2  // Slight tilt side-to-side
            );
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        scene.add(mesh);

        update = (time: number) => {
            customUniforms.uTime.value = time;
        };

        cleanup = () => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
        };

    } catch (e) {
        console.error("Rock generation failed", e);
    }

    return { update, cleanup };
};