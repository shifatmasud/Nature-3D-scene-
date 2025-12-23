/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Replaced named imports with a namespace import for Three.js to resolve module resolution errors.
import * as THREE from 'three';

// --- GLSL SHADERS ---

const vertexShader = `
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform vec3 uSunPosition;
uniform float uTime;
varying vec3 vWorldPosition;
varying vec2 vUv;

// --- NOISE FUNCTIONS ---
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + p.z * 113.0;
    return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

// FBM for Clouds
float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p *= 2.02;
    f += 0.2500 * noise(p); p *= 2.03;
    f += 0.1250 * noise(p); p *= 2.01;
    f += 0.0625 * noise(p);
    return f;
}

void main() {
    vec3 viewDirection = normalize(vWorldPosition);
    vec3 sunDirection = normalize(uSunPosition);
    
    float sunY = sunDirection.y;
    
    // --- COLORS ---
    vec3 dayTop = vec3(0.2, 0.6, 1.0); // Bright Blue
    vec3 dayBottom = vec3(0.7, 0.9, 1.0); // White-Blue
    
    vec3 nightTop = vec3(0.02, 0.02, 0.1); // Deep Purple-Black
    vec3 nightBottom = vec3(0.1, 0.1, 0.2); // Dark Blue
    
    vec3 sunsetTop = vec3(0.5, 0.3, 0.6); // Purple
    vec3 sunsetBottom = vec3(1.0, 0.5, 0.2); // Orange
    
    // --- MIXING ---
    float dayFactor = smoothstep(-0.2, 0.2, sunY);
    float sunsetFactor = 1.0 - abs(sunY * 3.0);
    sunsetFactor = clamp(sunsetFactor, 0.0, 1.0);
    
    vec3 skyTop = mix(nightTop, dayTop, dayFactor);
    vec3 skyBottom = mix(nightBottom, dayBottom, dayFactor);
    
    skyTop = mix(skyTop, sunsetTop, sunsetFactor * 0.5);
    skyBottom = mix(skyBottom, sunsetBottom, sunsetFactor * 0.8);
    
    float horizon = smoothstep(-0.1, 0.4, viewDirection.y);
    vec3 skyColor = mix(skyBottom, skyTop, horizon);
    
    // --- STARS (Night only) ---
    // Layer 1: Larger, brighter stars
    float stars1 = noise(viewDirection * 150.0);
    stars1 = smoothstep(0.985, 1.0, stars1);

    // Layer 2: Smaller, denser, fainter stars
    float stars2 = noise(viewDirection * 450.0);
    stars2 = smoothstep(0.97, 1.0, stars2) * 0.5; // Fainter

    // Twinkle effect based on time
    float twinkleNoise = noise(vec3(viewDirection.xy * 80.0, uTime * 0.1));
    float twinkle = mix(0.5, 1.0, twinkleNoise);
    
    float totalStars = (stars1 + stars2) * twinkle;
    
    float starVisible = totalStars * (1.0 - dayFactor);
    skyColor += vec3(starVisible);

    // --- CLOUDS ---
    float cloudSpeed = 0.03;
    // ADJUSTED SCALE for 600 radius
    vec3 cloudPos = vWorldPosition * 0.008 + vec3(uTime * cloudSpeed, 0.0, 0.0);
    float cloudNoise = fbm(cloudPos);
    
    float cloudDensity = smoothstep(0.4, 0.75, cloudNoise);
    
    vec3 cloudDayColor = vec3(1.0);
    vec3 cloudNightColor = vec3(0.15, 0.15, 0.25);
    vec3 cloudColor = mix(cloudNightColor, cloudDayColor, dayFactor);
    
    cloudColor = mix(cloudColor, vec3(1.0, 0.6, 0.4), sunsetFactor * 0.6);
    
    skyColor = mix(skyColor, cloudColor, cloudDensity * 0.7 * smoothstep(0.0, 0.2, viewDirection.y));

    gl_FragColor = vec4(skyColor, 1.0);
}
`;

export const createSky = (scene: THREE.Scene, theme: any) => {
    let update = (time: number, sunPos: THREE.Vector3) => {};
    let cleanup = () => {};

    try {
        // OPTIMIZED: Reduced geometry segments to 12x12 for low-res sky dome
        const geometry = new THREE.SphereGeometry(600, 12, 12);
        
        const uniforms = {
            uTime: { value: 0 },
            uSunPosition: { value: new THREE.Vector3(0, 1, 0) }
        };

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false 
        });

        const skyMesh = new THREE.Mesh(geometry, material);
        // Render sky first to ensure it's background
        skyMesh.renderOrder = -10; 
        scene.add(skyMesh);

        update = (time: number, sunPos: THREE.Vector3) => {
            uniforms.uTime.value = time;
            uniforms.uSunPosition.value.copy(sunPos);
        };

        cleanup = () => {
            scene.remove(skyMesh);
            geometry.dispose();
            material.dispose();
        };
    } catch (e) {
        console.error("Sky generation failed", e);
    }

    return { update, cleanup };
};