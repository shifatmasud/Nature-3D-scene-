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
        const customUniforms = { uTime: { value: 0 } };
        const count = positions.length;

        // GEOMETRY: Dodecahedron for blocky, chiseled rock look
        // Radius 1.0, Detail 0 (Low poly)
        const geometry = new THREE.DodecahedronGeometry(1.0, 0);

        // MATERIAL: Anime style - Flat shading with gradient
        const material = new THREE.MeshStandardMaterial({
            color: 0xD1D5DB, // PEACEFUL LIGHT: Soft Light Grey
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            
            // Inject varying for vertical gradient
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                varying float vRockY;
                `
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vRockY = position.y; 
                `
            );

            // Add gradient mix to fragment
            shader.fragmentShader = `
                varying float vRockY;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                // Anime Gradient: Darker at bottom (grounded), lighter at top
                // Local Y roughly -1 to 1
                float gradient = smoothstep(-1.2, 1.2, vRockY);
                // SOFT SHADOWS: Multiplier increased from 0.4 to 0.75 for a lighter, more peaceful look
                vec3 darkColor = diffuseColor.rgb * 0.75;
                vec3 lightColor = diffuseColor.rgb * 1.05;
                diffuseColor.rgb = mix(darkColor, lightColor, gradient);
                
                // Subtle edge highlight (fake rim) - based on facing up
                // Flat shading makes normals constant per face, so this highlights top faces
                // We don't have vNormal in standard fragment usually unless enabled, 
                // but flatShading gives us face normals implicitly.
                `
            );
        };

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        for (let i = 0; i < count; i++) {
            const p = positions[i];
            
            // Randomize Scale for "Big" look
            // Base scale 1.5 to 2.5
            const baseScale = 1.5 + Math.random() * 1.0;
            const stretchX = 0.8 + Math.random() * 0.4;
            const stretchY = 0.6 + Math.random() * 0.4; // Slightly flatter
            const stretchZ = 0.8 + Math.random() * 0.4;

            const scaleX = baseScale * stretchX;
            const scaleY = baseScale * stretchY;
            const scaleZ = baseScale * stretchZ;

            // Placement
            const displacementScale = 0.3; 
            const groundHeight = getGroundElevation(p.x, p.z) * displacementScale;
            // Sink it into the ground significantly (40% of height) to look heavy
            const y = -1.5 + groundHeight - (scaleY * 0.4); 

            dummy.position.set(p.x, y, p.z);
            dummy.scale.set(scaleX, scaleY, scaleZ);
            
            // Random Rotation
            dummy.rotation.set(
                Math.random() * Math.PI, 
                Math.random() * Math.PI * 2, 
                Math.random() * Math.PI
            );
            
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);

            // Subtle color variation - PEACEFUL PALETTE
            color.setHex(0xD1D5DB);
            // Varies from neutral grey to slightly warm stone
            const hueShift = (Math.random() - 0.5) * 0.05; 
            const lightShift = (Math.random() - 0.5) * 0.05;
            color.offsetHSL(hueShift, 0, lightShift);
            mesh.setColorAt(i, color);
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
