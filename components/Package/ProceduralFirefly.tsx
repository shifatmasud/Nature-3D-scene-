/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Replaced named imports with a namespace import for Three.js to resolve module resolution errors.
import * as THREE from 'three';

export const createFireflies = (
    scene: THREE.Scene,
    theme: any,
    count: number,
    bounds: { width: number, height: number, depth: number },
    camera: THREE.PerspectiveCamera
) => {
    let update = (time: number) => {};
    let cleanup = () => {};

    try {
        const geometry = new THREE.SphereGeometry(0.08, 4, 4);
        
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const customUniforms = {
            uTime: { value: 0 },
            uCameraPos: { value: new THREE.Vector3() },
        };

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uCameraPos = customUniforms.uCameraPos;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform vec3 uCameraPos;
                attribute float aPhase;
                attribute float aScale;
                varying float vType;
                attribute float aType; // 0 = Gold, 1 = Purple
                varying vec3 vWorldPosition;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vType = aType;
                
                float t_pulse = uTime * 0.5 + aPhase;
                float pulse = 0.8 + 0.4 * sin(t_pulse * 3.0);
                vec3 pulsedPos = position * aScale * pulse;
                
                vec4 worldPos = instanceMatrix * vec4(pulsedPos, 1.0);
                vWorldPosition = worldPos.xyz;

                // --- Animation LOD ---
                float dist = length(vWorldPosition - uCameraPos);
                float anim_lod_start = 10.0;
                float anim_lod_end = 15.0;
                float anim_lod_factor = 1.0 - smoothstep(anim_lod_start, anim_lod_end, dist);
                
                float t_float = uTime * 0.5 + aPhase;
                vec3 offset = vec3(
                    sin(t_float * 1.5) * 0.5,
                    sin(t_float * 2.0) * 0.5,
                    cos(t_float * 1.5) * 0.5
                );
                worldPos.xyz += offset * anim_lod_factor;
                
                vec4 mvPosition = viewMatrix * worldPos;
                gl_Position = projectionMatrix * mvPosition;
                `
            );
             shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                `// Replaced by custom logic in <begin_vertex>`
             );


            shader.fragmentShader = `
                uniform vec3 uCameraPos;
                varying float vType;
                varying vec3 vWorldPosition;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                vec3 gold = vec3(1.0, 0.84, 0.0);
                vec3 purple = vec3(0.8, 0.2, 1.0);
                
                vec3 finalColor = mix(gold, purple, vType);
                
                // --- Culling LOD ---
                float dist = length(vWorldPosition - uCameraPos);
                float fadeStart = 15.0; 
                float fadeEnd = 20.0;
                float alpha = 1.0 - smoothstep(fadeStart, fadeEnd, dist);

                if (alpha < 0.05) {
                    discard;
                }

                diffuseColor.rgb = finalColor;
                diffuseColor.a = alpha;
                `
            );
        };

        const mesh = new THREE.InstancedMesh(geometry, material, count);

        const dummy = new THREE.Object3D();
        const phases = new Float32Array(count);
        const types = new Float32Array(count);
        const scales = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * bounds.width;
            const y = Math.random() * bounds.height + 0.5;
            const z = (Math.random() - 0.5) * bounds.depth;

            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            
            phases[i] = Math.random() * Math.PI * 2;
            types[i] = Math.random() > 0.5 ? 1.0 : 0.0;
            scales[i] = 0.5 + Math.random() * 1.0;
        }

        mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
        mesh.geometry.setAttribute('aType', new THREE.InstancedBufferAttribute(types, 1));
        mesh.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
        
        scene.add(mesh);

        update = (time: number) => {
            customUniforms.uTime.value = time;
            customUniforms.uCameraPos.value.copy(camera.position); 
        };

        cleanup = () => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            mesh.dispose();
        };

    } catch (e) {
        console.error("Firefly generation failed", e);
    }

    return { update, cleanup };
};