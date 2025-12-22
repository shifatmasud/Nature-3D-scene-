
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

// --- HELPERS ---
const mulberry32 = (a: number) => {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};

export const createBalloons = (scene: THREE.Scene, camera: THREE.Camera, theme: any, count: number) => {
    const originalRandom = Math.random;
    const seed = 78910;
    const rng = mulberry32(seed);
    Math.random = rng;

    let update = (time: number, dayFactor: number) => {};
    let cleanup = () => {};

    try {
        const group = new THREE.Group();
        
        // Simple procedural geometries
        const balloonGeo = new THREE.SphereGeometry(1.5, 16, 12);
        const basketGeo = new THREE.CylinderGeometry(0.4, 0.3, 0.5, 8);
        const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4);

        // Vibrant Anime Red
        const balloonColor = 0xEE4444;
        
        const balloons: { 
            mesh: THREE.Group, 
            material: THREE.MeshStandardMaterial,
            basketMaterial: THREE.MeshStandardMaterial,
            pivot: THREE.Vector3, 
            radius: number, 
            speed: number, 
            phase: number,
            yBase: number
        }[] = [];

        for (let i = 0; i < count; i++) {
            const balloonGroup = new THREE.Group();
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: balloonColor, 
                roughness: 0.6,
                metalness: 0.1,
                emissive: balloonColor,
                emissiveIntensity: 0,
                // Disable fog initially; we will manage it dynamically or keep it off for daytime pop
                fog: false 
            });

            const basketMat = new THREE.MeshStandardMaterial({ 
                color: 0x8B4513, 
                roughness: 1.0 
            });

            // Balloon top
            const mesh = new THREE.Mesh(balloonGeo, mat);
            mesh.scale.set(1, 1.3, 1);
            balloonGroup.add(mesh);

            // Ropes
            for(let j = 0; j < 4; j++) {
                const rope = new THREE.Mesh(ropeGeo, basketMat);
                const angle = (j / 4) * Math.PI * 2;
                rope.position.set(Math.cos(angle) * 0.8, -1.2, Math.sin(angle) * 0.8);
                rope.rotation.z = (j % 2 === 0 ? 0.2 : -0.2);
                balloonGroup.add(rope);
            }

            // Basket
            const basket = new THREE.Mesh(basketGeo, basketMat);
            basket.position.y = -2.0;
            balloonGroup.add(basket);

            // Inner light for night mode
            const innerLight = new THREE.PointLight(balloonColor, 0, 8);
            innerLight.position.y = -1;
            balloonGroup.add(innerLight);

            scene.add(balloonGroup);

            balloons.push({
                mesh: balloonGroup,
                material: mat,
                basketMaterial: basketMat,
                pivot: new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40),
                radius: 12 + Math.random() * 18,
                speed: 0.08 + Math.random() * 0.15,
                phase: Math.random() * Math.PI * 2,
                yBase: 18 + Math.random() * 12
            });
        }

        update = (time: number, dayFactor: number) => {
            const nightFactor = 1.0 - dayFactor;
            
            balloons.forEach((b) => {
                const dist = b.mesh.position.distanceTo(camera.position);
                const anim_lod_start = 20.0;
                const anim_lod_end = 40.0;
                const anim_lod_factor = 1.0 - THREE.MathUtils.smoothstep(anim_lod_start, anim_lod_end, dist);

                const angle = time * b.speed + b.phase;
                b.mesh.position.x = b.pivot.x + Math.cos(angle) * b.radius;
                b.mesh.position.z = b.pivot.z + Math.sin(angle) * b.radius;
                b.mesh.position.y = b.yBase + Math.sin(time * 0.5 + b.phase) * 2.5;
                
                // Subtle rotation towards direction of travel
                b.mesh.rotation.y = angle + Math.PI / 2;
                b.mesh.rotation.z = Math.sin(time * 0.8 + b.phase) * 0.08 * anim_lod_factor;

                // Toggle fog based on dayFactor: 
                // We want balloons to ignore fog in the day for that "clean" look.
                // In night mode, a bit of fog helps them feel integrated into the misty atmosphere.
                const shouldFog = dayFactor < 0.2;
                if (b.material.fog !== shouldFog) {
                    b.material.fog = shouldFog;
                    b.material.needsUpdate = true;
                }

                // Night glow
                b.material.emissiveIntensity = nightFactor * 0.9;
                const light = b.mesh.children.find(c => c instanceof THREE.PointLight) as THREE.PointLight;
                if (light) {
                    light.intensity = nightFactor * 25;
                }
            });
        };

        cleanup = () => {
            balloons.forEach(b => {
                scene.remove(b.mesh);
                b.material.dispose();
                b.basketMaterial.dispose();
            });
            balloonGeo.dispose();
            basketGeo.dispose();
            ropeGeo.dispose();
        };

    } catch (e) {
        console.error("Balloon generation failed", e);
    } finally {
        Math.random = originalRandom;
    }

    return { update, cleanup };
};
