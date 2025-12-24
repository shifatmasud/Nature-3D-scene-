
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { 
  Scene, 
  Vector3, 
  SphereGeometry, 
  ShaderMaterial, 
  BackSide, 
  Mesh 
} from 'three';

// --- GLSL SHADERS ---

const vertexShader = `
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec2 vUv;

void main() {
  vLocalPosition = position;
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
varying vec3 vLocalPosition;
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
    vec3 localDirection = normalize(vLocalPosition);
    vec3 sunDirection = normalize(uSunPosition);
    
    float sunY = sunDirection.y;
    
    // --- COLORS (toned down to prevent bloom) ---
    vec3 dayTop = vec3(0.2, 0.55, 0.9); 
    vec3 dayBottom = vec3(0.6, 0.8, 0.9);
    
    vec3 nightTop = vec3(0.02, 0.02, 0.1); 
    vec3 nightBottom = vec3(0.1, 0.1, 0.2);
    
    vec3 sunsetTop = vec3(0.45, 0.25, 0.55); 
    vec3 sunsetBottom = vec3(0.9, 0.45, 0.2); 
    
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
    
    // --- CLOUDS ---
    float cloudSpeed = 0.01; 
    vec3 cloudPos = vWorldPosition * 0.008 + vec3(uTime * cloudSpeed, 0.0, 0.0);
    float cloudNoise = fbm(cloudPos);
    
    float cloudDensity = smoothstep(0.4, 0.75, cloudNoise);
    
    vec3 cloudDayColor = vec3(0.9);
    vec3 cloudNightColor = vec3(0.15, 0.15, 0.25);
    vec3 cloudColor = mix(cloudNightColor, cloudDayColor, dayFactor);
    
    cloudColor = mix(cloudColor, vec3(0.9, 0.5, 0.35), sunsetFactor * 0.6);
    
    skyColor = mix(skyColor, cloudColor, cloudDensity * 0.7 * smoothstep(0.0, 0.2, viewDirection.y));

    gl_FragColor = vec4(skyColor, 1.0);
}
`;

export const createSky = (scene: Scene, theme: any) => {
    let update = (time: number, sunPos: Vector3, cameraPos: Vector3) => {};
    let cleanup = () => {};

    try {
        const geometry = new SphereGeometry(600, 12, 12);
        
        const uniforms = {
            uTime: { value: 0 },
            uSunPosition: { value: new Vector3(0, 1, 0) }
        };

        const material = new ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
            side: BackSide,
            depthWrite: false,
            fog: false 
        });

        const skyMesh = new Mesh(geometry, material);
        skyMesh.renderOrder = -10; 
        scene.add(skyMesh);

        update = (time: number, sunPos: Vector3, cameraPos: Vector3) => {
            // Anchor sky to camera to prevent star parallax when zooming/moving
            skyMesh.position.copy(cameraPos);
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
