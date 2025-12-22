
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

export const createFireflies = (
    scene: THREE.Scene,
    theme: any,
    count: number,
    bounds: { width: number, height: number, depth: number },
    // FIX: Add camera parameter to createFireflies function
    camera: THREE.Camera 
) => {
    let update = (time: number) => {};
    let cleanup = () => {};

    try {
        // REDUCED GEOMETRY SEGMENTS for ultra low-res look
        const geometry = new THREE.SphereGeometry(0.08, 4, 4);
        
        // Custom shader for glowing effect
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true, // Needed for alpha in fragment shader
            blending: THREE.AdditiveBlending, // For glowing effect
            depthWrite: false, // Prevents depth conflicts with transparent objects
        });

        const customUniforms = {
            uTime: { value: 0 },
            uCameraPos: { value: new THREE.Vector3() }, // Added for LOD
            uCameraNear: { value: 0.1 }, // Added for LOD
            uCameraFar: { value: 2000 } // Added for LOD
        };

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uCameraPos = customUniforms.uCameraPos;
            shader.uniforms.uCameraNear = customUniforms.uCameraNear;
            shader.uniforms.uCameraFar = customUniforms.uCameraFar;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                attribute float aPhase;
                attribute float aScale;
                attribute vec3 aBasePos;
                varying float vType;
                attribute float aType; // 0 = Gold, 1 = Purple
                varying vec3 vWorldPosition; // Pass world position for fragment LOD
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vType = aType;
                
                // Floating Animation
                float t = uTime * 0.5 + aPhase;
                
                vec3 offset = vec3(
                    sin(t * 1.5) * 0.5,
                    sin(t * 2.0) * 0.5,
                    cos(t * 1.5) * 0.5
                );
                
                vec3 newPos = aBasePos + offset;
                
                // Pulse Size
                float pulse = 0.8 + 0.4 * sin(t * 3.0);
                transformed = position * aScale * pulse;
                
                transformed += offset; 

                vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                `
            );

            shader.fragmentShader = `
                uniform vec3 uCameraPos;
                uniform float uCameraNear;
                uniform float uCameraFar;
                varying float vType;
                varying vec3 vWorldPosition;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                vec3 gold = vec3(1.0, 0.84, 0.0);
                vec3 purple = vec3(0.8, 0.2, 1.0); // Bright Purple
                
                vec3 finalColor = mix(gold, purple, vType);
                
                // Shader-based LOD: fade out based on distance
                float dist = length(vWorldPosition - uCameraPos);
                // Adjust fade start and end based on scene scale and visual preference
                float fadeStart = 40.0; 
                float fadeEnd = 60.0;
                float alpha = 1.0 - smoothstep(fadeStart, fadeEnd, dist);

                if (alpha < 0.05) { // Early exit for very transparent fragments
                    discard;
                }

                diffuseColor.rgb = finalColor;
                diffuseColor.a = alpha;
                `
            );
        };

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        const phases = new Float32Array(count);
        const types = new Float32Array(count);
        const scales = new Float32Array(count);
        const basePos = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * bounds.width;
            const y = Math.random() * bounds.height + 0.5; // Keep above ground
            const z = (Math.random() - 0.5) * bounds.depth;

            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            
            phases[i] = Math.random() * Math.PI * 2;
            types[i] = Math.random() > 0.5 ? 1.0 : 0.0; // 50/50 split
            scales[i] = 0.5 + Math.random() * 1.0;
        }

        mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
        mesh.geometry.setAttribute('aType', new THREE.InstancedBufferAttribute(types, 1));
        mesh.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
        
        scene.add(mesh);

        update = (time: number) => {
            customUniforms.uTime.value = time;
            // FIX: Use the camera parameter from the function scope
            customUniforms.uCameraPos.value.copy(camera.position); 
            customUniforms.uCameraNear.value = camera.near;
            customUniforms.uCameraFar.value = camera.far;
        };

        cleanup = () => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
        };

    } catch (e) {
        console.error("Firefly generation failed", e);
    }

    return { update, cleanup };
};