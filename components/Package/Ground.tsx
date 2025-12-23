
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Switched to named imports for Three.js members to resolve type definition mismatch and property availability issues.
import { 
  CanvasTexture, 
  RepeatWrapping, 
  SRGBColorSpace, 
  Scene, 
  PlaneGeometry, 
  MeshStandardMaterial, 
  DoubleSide, 
  Color, 
  Vector3, 
  Mesh, 
  PerspectiveCamera 
} from 'three';

// Shared math for ground elevation.
export const getGroundElevation = (x: number, y: number) => {
  return 0.0;
};

// Procedural texture for distant grass impostor
const createGroundGrassTexture = () => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#669966'; // Base color, should match ground
    ctx.fillRect(0, 0, size, size);

    const bladeCount = 5000;
    for (let i = 0; i < bladeCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const height = 5 + Math.random() * 10;
        const width = 0.5 + Math.random() * 1;
        const angle = (Math.random() - 0.5) * 0.5;
        
        const v = Math.random();
        let color = '';
        if (v > 0.6) color = '#B2D8B2'; 
        else if (v > 0.2) color = '#88C488'; 
        else color = '#66A566';
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    return texture;
};

const createBakedShadowTexture = (
    width: number, 
    height: number,
    objectPositions: {
        rocks: {x: number, z: number}[],
        trees: {x: number, z: number}[],
        bushes: {x: number, z: number}[]
    },
    spread: number
) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // White background means no shadow
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const drawShadow = (x: number, z: number, radius: number, intensity: number) => {
        const u = (x / spread + 0.5) * width;
        const v = (z / spread + 0.5) * height;

        const gradient = ctx.createRadialGradient(u, v, 0, u, v, radius);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(u - radius, v - radius, radius * 2, radius * 2);
    };

    // Draw shadows for each object type
    // Radius and intensity are in canvas units/values
    objectPositions.trees.forEach(p => drawShadow(p.x, -p.z, width * 0.1, 0.4));
    objectPositions.rocks.forEach(p => drawShadow(p.x, -p.z, width * 0.08, 0.35));
    objectPositions.bushes.forEach(p => drawShadow(p.x, -p.z, width * 0.06, 0.25));

    const texture = new CanvasTexture(canvas);
    texture.flipY = false;
    return texture;
};


export const createGround = (
    scene: Scene, 
    theme: any,
    shadowCasters: {
        rocks: {x: number, z: number}[],
        trees: {x: number, z: number}[],
        bushes: {x: number, z: number}[]
    }
) => {
  let update = (time: number) => {};
  let cleanup = () => {};

  try {
    const geometry = new PlaneGeometry(20, 20, 16, 16);
    const grassImpostorTexture = createGroundGrassTexture();
    const shadowTexture = createBakedShadowTexture(256, 256, shadowCasters, 20.0);
    
    const material = new MeshStandardMaterial({
      color: 0x669966, 
      roughness: 1.0,
      metalness: 0.0,
      side: DoubleSide,
      fog: true, 
    });

    const customUniforms = { 
      uTime: { value: 0 },
      uColorHigh: { value: new Color(0x88C488) },
      uColorLow: { value: new Color(0x66A566) },
      uGrassTexture: { value: grassImpostorTexture },
      uShadowMap: { value: shadowTexture },
      uCameraPosition: { value: new Vector3() },
    };

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = customUniforms.uTime;
      shader.uniforms.uColorHigh = customUniforms.uColorHigh;
      shader.uniforms.uColorLow = customUniforms.uColorLow;
      shader.uniforms.uGrassTexture = customUniforms.uGrassTexture;
      shader.uniforms.uShadowMap = customUniforms.uShadowMap;
      shader.uniforms.uCameraPosition = customUniforms.uCameraPosition;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform float uTime;
        varying float vElevation;
        varying vec2 vGroundUv;
        varying vec3 vWorldPosition;
        
        float getElevation(vec2 p) {
          return 0.0;
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

      shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `
          #include <worldpos_vertex>
          vWorldPosition = (modelMatrix * vec4( transformed, 1.0 )).xyz;
          `
      );

      shader.fragmentShader = `
        uniform vec3 uColorHigh;
        uniform vec3 uColorLow;
        uniform sampler2D uGrassTexture;
        uniform sampler2D uShadowMap;
        uniform vec3 uCameraPosition;
        varying float vElevation;
        varying vec2 vGroundUv;
        varying vec3 vWorldPosition;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float mixFactor = smoothstep(-1.0, 1.0, vElevation);
        vec3 groundColor = mix(uColorLow, uColorHigh, mixFactor);
        
        // --- IMPOSTOR GRASS ---
        float dist = length(vWorldPosition - uCameraPosition);
        float grass_fade_start = 10.0;
        float grass_fade_end = 15.0;
        float grass_texture_opacity = smoothstep(grass_fade_start, grass_fade_end, dist);
        
        vec2 grassUv = vWorldPosition.xz * 2.0;
        vec4 grassTex = texture2D(uGrassTexture, grassUv);
        
        diffuseColor.rgb = mix(groundColor, grassTex.rgb, grass_texture_opacity);
        
        // --- BAKED SHADOW ---
        float shadow = texture2D(uShadowMap, vGroundUv).r;
        diffuseColor.rgb *= shadow;
        `
      );
    };

    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; 
    mesh.position.y = -1.5; 
    mesh.receiveShadow = false;
    
    scene.add(mesh);

    update = (time: number) => {
      customUniforms.uTime.value = time;
      const camera = scene.getObjectByProperty("isPerspectiveCamera", true) as PerspectiveCamera;
      if (camera) {
          customUniforms.uCameraPosition.value.copy(camera.position);
      }
    };

    cleanup = () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      grassImpostorTexture.dispose();
      shadowTexture.dispose();
    };

  } catch(e) {
    console.error("Ground generation failed", e);
  }


  return { update, cleanup };
};
