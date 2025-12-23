
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Switched to named imports for Three.js members to correctly resolve types and avoid namespace property errors.
import { 
  Scene, 
  CircleGeometry, 
  Color, 
  ShaderMaterial 
} from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const createWater = (scene: Scene, theme: any) => {
    let update = (time: number, dayFactor: number, reflectionEnabled: boolean) => {};
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
            uWaveFrequency: { value: 10.0 },
            uWaveAmplitude: { value: 0.005 },
            uNightColor: { value: new Color(0x3a4a5a) },
            uDayColor: { value: new Color(0xA9DDF3) },
            uFoamColor: { value: new Color(0xffffff) },
            uShoreDistance: { value: 10.5 },
            uFoamSoftness: { value: 1.0 },
            uReflectionEnabled: { value: 1.0 }, // Reactive toggle
        };

        // --- PERFORMANCE OPTIMIZATION: Prevent reflection rendering when disabled ---
        const originalOnBeforeRender = reflector.onBeforeRender;
        reflector.onBeforeRender = function(renderer, scene, camera) {
            if (customUniforms.uReflectionEnabled.value > 0.5) {
                originalOnBeforeRender.call(this, renderer, scene, camera);
            }
        };

        const material = reflector.material as ShaderMaterial;
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = customUniforms.uTime;
            shader.uniforms.uDayFactor = customUniforms.uDayFactor;
            shader.uniforms.uWaveFrequency = customUniforms.uWaveFrequency;
            shader.uniforms.uWaveAmplitude = customUniforms.uWaveAmplitude;
            shader.uniforms.uNightColor = customUniforms.uNightColor;
            shader.uniforms.uDayColor = customUniforms.uDayColor;
            shader.uniforms.uFoamColor = customUniforms.uFoamColor;
            shader.uniforms.uShoreDistance = customUniforms.uShoreDistance;
            shader.uniforms.uFoamSoftness = customUniforms.uFoamSoftness;
            shader.uniforms.uReflectionEnabled = customUniforms.uReflectionEnabled;

            shader.vertexShader = `
                uniform float uTime;
                varying vec3 vWorldPosition;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldPosition = worldPosition.xyz;
                `
            );
            
            shader.fragmentShader = `
                uniform float uTime;
                uniform float uDayFactor;
                uniform float uWaveFrequency;
                uniform float uWaveAmplitude;
                uniform vec3 uNightColor;
                uniform vec3 uDayColor;
                uniform vec3 uFoamColor;
                uniform float uShoreDistance;
                uniform float uFoamSoftness;
                uniform float uReflectionEnabled;
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
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 diffuseColor = vec4( color, 1.0 );',
                `
                vec2 distortedUv = vUv + vec2(
                    sin(vWorldPosition.x * uWaveFrequency + uTime * 0.5) * uWaveAmplitude,
                    cos(vWorldPosition.z * uWaveFrequency + uTime * 0.5) * uWaveAmplitude
                );
                
                vec4 reflectedColor = texture2D(tDiffuse, distortedUv);
                float reflectionFactor = reflectedColor.a * uReflectionEnabled;
                
                vec3 waterBaseColor = mix(uNightColor, uDayColor, uDayFactor);

                // --- SURFACE RIPPLES ---
                float surfaceRippleNoise = fbm(vWorldPosition * 0.5 + uTime * 0.1);
                vec3 waterSurfaceColor = mix(waterBaseColor, waterBaseColor * 1.2, surfaceRippleNoise);
                
                // --- FOAM ---
                float distToCenter = length(vWorldPosition.xz);
                float foamNoise = fbm(vWorldPosition * 2.0 + uTime * 0.2);
                float foamEdge = uShoreDistance - foamNoise * uFoamSoftness;
                float foamFactor = smoothstep(foamEdge, foamEdge - uFoamSoftness, distToCenter);

                // --- COMBINE ---
                vec3 finalColor = mix(waterSurfaceColor, reflectedColor.rgb, reflectionFactor * 0.9);
                finalColor = mix(finalColor, uFoamColor, foamFactor * 0.7);

                vec4 diffuseColor = vec4(finalColor, 1.0);
                `
            );
        };

        scene.add(reflector);

        update = (time: number, dayFactor: number, reflectionEnabled: boolean) => {
            customUniforms.uTime.value = time;
            customUniforms.uDayFactor.value = dayFactor;
            customUniforms.uReflectionEnabled.value = reflectionEnabled ? 1.0 : 0.0;
        };

        cleanup = () => {
            scene.remove(reflector);
            waterGeometry.dispose();
            (material).dispose();
        };

    } catch (e) {
        console.error("Water generation failed", e);
    }

    return { update, cleanup };
};
