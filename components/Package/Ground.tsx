

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

// Shared math for ground elevation (synchronized with shader)
export const getGroundElevation = (x: number, y: number) => {
  let e = 0.0;
  e += Math.sin(x * 0.3) * 0.5;
  e += Math.sin(y * 0.2) * 0.5;
  e += Math.sin(x * 0.8 + y * 0.6) * 0.1;
  return e;
};

export const createGround = (scene: THREE.Scene, theme: any) => {
  // OPTIMIZATION: Reduced segments from 32x32 to 16x16
  const geometry = new THREE.PlaneGeometry(20, 20, 16, 16);
  
  const material = new THREE.MeshStandardMaterial({
    // MATCH NEW PALETTE: Darker base to allow grass to pop
    color: 0x669966, 
    roughness: 1.0, // Fully matte for anime look
    metalness: 0.0,
    flatShading: false, 
    side: THREE.DoubleSide,
    fog: true, // Allow this material to be affected by scene fog
  });

  const customUniforms = { 
    uTime: { value: 0 },
    // FAKE AO: Darker low color to simulate occlusion in valleys
    uColorHigh: { value: new THREE.Color(0x99C299) }, // Slightly dimmed light green
    uColorLow: { value: new THREE.Color(0x447744) }   // Deep dark green for fake shadow
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = customUniforms.uTime;
    shader.uniforms.uColorHigh = customUniforms.uColorHigh;
    shader.uniforms.uColorLow = customUniforms.uColorLow;

    // FIX: Safe injection
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      uniform float uTime;
      varying float vElevation;
      varying vec2 vGroundUv;
      
      float getElevation(vec2 p) {
        float e = 0.0;
        e += sin(p.x * 0.3) * 0.5;
        e += sin(p.y * 0.2) * 0.5;
        e += sin(p.x * 0.8 + p.y * 0.6) * 0.1;
        return e;
      }
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vGroundUv = uv;
      float elevation = getElevation(position.xy);
      vElevation = elevation;
      vec3 newPos = position + normal * elevation * 0.3;
      transformed = newPos;
      `
    );

    shader.fragmentShader = `
      uniform vec3 uColorHigh;
      uniform vec3 uColorLow;
      varying float vElevation;
      varying vec2 vGroundUv;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float mixFactor = smoothstep(-1.0, 1.0, vElevation);
      vec3 groundColor = mix(uColorLow, uColorHigh, mixFactor);
      diffuseColor.rgb = groundColor;
      `
    );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; 
  mesh.position.y = -1.5; 
  mesh.receiveShadow = true; // Ground still receives shadows from bushes (optional, but good for depth)
  
  scene.add(mesh);

  const update = (time: number) => {
    customUniforms.uTime.value = time;
  };

  const cleanup = () => {
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
  };

  return { update, cleanup };
};