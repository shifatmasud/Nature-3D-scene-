/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Switched to named imports for Three.js members to correctly resolve types and avoid namespace property errors.
import { 
  Scene, 
  CircleGeometry, 
  Color, 
  ShaderMaterial,
  Vector3
} from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const createWater = (scene: Scene, theme: any) => {
    let update = (time: number, dayFactor: number, reflectionEnabled: boolean, sunPosition: Vector3) => {};
    let cleanup = () => {};

    try {
        const waterGeometry = new CircleGeometry(20, 32);

        const reflector = new Reflector(waterGeometry, {
            clipBias: 0.003,
            textureWidth: 256, // Low res for performance and stylized look
            textureHeight: 256,
            color: new Color(0x8899aa), // Base water color
        });

        reflector.position.y = -1.6;
        reflector.rotation.x = -Math.PI / 2;

        const customUniforms = {
            uTime: { value: 0 },
            uDayFactor: { value: 1.0 },
            uNightColor: { value: new Color(0x3a4a5a) },
            uDayColor: { value: new Color(0xA9DDF3) },
            uFoamColor: { value: new Color(0xffffff) },
            uShoreDistance: { value: 10.5 },
            uFoamSoftness: { value: 1.0 },
            uReflectionEnabled: { value: 1.0 },
            uSunPosition: { value: new Vector3() },
        };

        const originalOnBeforeRender = reflector.onBeforeRender;
        reflector.onBeforeRender = function(renderer, scene, camera) {
            if (customUniforms.uReflectionEnabled.value > 0.5) {
                originalOnBeforeRender.call(this, renderer, scene, camera);
            }
        };

        const material = reflector.material as ShaderMaterial;

        Object.assign(material.uniforms, customUniforms);
        
        material.vertexShader = `
            uniform mat4 textureMatrix;
            varying vec4 vUv;
            varying vec3 vWorldPosition;

            void main() {
                vUv = textureMatrix * vec4( position, 1.0 );
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `;
        
        material.fragmentShader = `
            uniform sampler2D tDiffuse;
            uniform float uTime;
            uniform float uDayFactor;
            uniform vec3 uNightColor;
            uniform vec3 uDayColor;
            uniform vec3 uFoamColor;
            uniform float uShoreDistance;
            uniform float uFoamSoftness;
            uniform float uReflectionEnabled;
            uniform vec3 uSunPosition;
            
            varying vec4 vUv;
            varying vec3 vWorldPosition;

            float hash(float n) { return fract(sin(n) * 43758.5453123); }
            float noise(vec3 x) {
                vec3 i = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
                float n = i.x + i.y * 57.0 + i.z * 113.0;
                return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                               mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                           mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                               mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
            }
            float fbm(vec3 p) {
                float f = 0.0;
                f += 0.5000 * noise(p); p *= 2.02;
                f += 0.2500 * noise(p);
                return f;
            }

            void main() {
                if (uReflectionEnabled > 0.5) {
                    vec2 distortedUv = vUv.xy / vUv.w;
                    // Calmer ripples for reflection
                    distortedUv += vec2(
                        sin(vWorldPosition.x * 8.0 + uTime * 0.2) * 0.008,
                        cos(vWorldPosition.z * 8.0 + uTime * 0.2) * 0.008
                    );
                    
                    vec4 reflectedColor = texture2D(tDiffuse, distortedUv);
                    vec3 waterBaseColor = mix(uNightColor, uDayColor, uDayFactor);
                    
                    vec3 finalReflectiveColor = mix(waterBaseColor, reflectedColor.rgb, reflectedColor.a * 0.9);
                    
                    float distToCenter = length(vWorldPosition.xz);
                    float foamNoise = fbm(vWorldPosition * 2.0 + uTime * 0.2);
                    float foamEdge = uShoreDistance - foamNoise * uFoamSoftness;
                    float foamFactor = smoothstep(foamEdge, foamEdge - uFoamSoftness, distToCenter);
                    
                    gl_FragColor = vec4(mix(finalReflectiveColor, uFoamColor, foamFactor * 0.7), 1.0);

                } else {
                    // --- STYLIZED ANIME WATER (CLEAN & CALM) ---

                    // --- LAYER 1: Base Color Gradient ---
                    vec3 waterBaseColor = mix(uNightColor, uDayColor, uDayFactor);
                    vec3 deepColor = waterBaseColor * 0.7;
                    vec3 shallowColor = waterBaseColor * 1.2;
                    float distToCenter = length(vWorldPosition.xz);
                    float depthFactor = smoothstep(uShoreDistance - 3.0, uShoreDistance, distToCenter);
                    vec3 finalColor = mix(shallowColor, deepColor, depthFactor);

                    // --- LAYER 2: Stylized Ripple Highlights ---
                    float time = uTime * 0.1;
                    vec2 uv1 = vWorldPosition.xz * 0.25 + time;
                    float wave1 = sin(uv1.x * 5.0 + sin(uv1.y * 10.0 + time * 1.5) * 0.5);
                    wave1 = smoothstep(0.8, 0.85, wave1);

                    vec2 uv2 = vWorldPosition.xz * 0.2;
                    uv2.x -= time * 1.2;
                    float wave2 = sin(uv2.y * 6.0 + sin(uv2.x * 12.0 - time * 2.0) * 0.4);
                    wave2 = smoothstep(0.85, 0.9, wave2);

                    float rippleHighlightFactor = max(wave1, wave2);
                    vec3 rippleHighlightColor = uFoamColor * 0.8;
                    finalColor = mix(finalColor, rippleHighlightColor, rippleHighlightFactor * (1.0 - depthFactor));

                    // --- LAYER 3: Sun Glint ---
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    vec3 sunDir = normalize(uSunPosition);
                    vec3 flatNormal = vec3(0.0, 1.0, 0.0);
                    vec3 reflectDir = reflect(-sunDir, flatNormal);
                    float spec = max(dot(viewDir, reflectDir), 0.0);
                    float sharpSpecular = pow(spec, 64.0);
                    vec3 specularColor = vec3(1.0, 0.98, 0.95);
                    finalColor += specularColor * sharpSpecular * 5.0 * uDayFactor;

                    // --- LAYER 4: Shore Foam ---
                    float foamNoise = fbm(vWorldPosition * 2.0 + uTime * 0.3);
                    float foamEdge = uShoreDistance - foamNoise * (uFoamSoftness * 0.5);
                    float foamFactor = smoothstep(foamEdge, foamEdge - 0.3, distToCenter);
                    finalColor = mix(finalColor, uFoamColor, foamFactor);

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            }
        `;

        scene.add(reflector);

        update = (time: number, dayFactor: number, reflectionEnabled: boolean, sunPosition: Vector3) => {
            material.uniforms.uTime.value = time;
            material.uniforms.uDayFactor.value = dayFactor;
            material.uniforms.uReflectionEnabled.value = reflectionEnabled ? 1.0 : 0.0;
            material.uniforms.uSunPosition.value.copy(sunPosition);
        };

        cleanup = () => {
            scene.remove(reflector);
            waterGeometry.dispose();
            material.dispose();
        };

    } catch (e) {
        console.error("Water generation failed", e);
    }

    return { update, cleanup };
};
