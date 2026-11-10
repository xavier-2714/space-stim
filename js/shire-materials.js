import * as THREE from 'three';

const noise = `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.37, 0.73));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float grain(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

export function shireMaterial(terrain) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  material.customProgramCacheKey = () => terrain ? 'shire-ground' : 'shire-objects';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 shirePosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      shirePosition = (modelMatrix * vec4(position, 1.0)).xyz;
    `);
    shader.fragmentShader = 'varying vec3 shirePosition;\n' + noise + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float coarse = grain(shirePosition * ${terrain ? '0.38' : '2.2'});
      float fine = grain(shirePosition * 17.0);
      float detail = grain(shirePosition * 63.0);
      diffuseColor.rgb *= 0.70 + 0.35 * coarse + 0.24 * fine + 0.08 * detail;
      ${terrain ? 'diffuseColor.rgb *= mix(vec3(1.08, 0.93, 0.77), vec3(0.90, 1.12, 0.92), smoothstep(0.24, 0.76, coarse));' : ''}
    `);
  };
  return material;
}

export function shireWater() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]);
  return new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true, depthWrite: false,
    vertexShader: `
      #include <common>
      varying vec3 waterPosition;
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      void main() {
        waterPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 waterPosition;
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      ${noise}
      void main() {
        #include <logdepthbuf_fragment>
        vec2 p = waterPosition.xz;
        float a = p.x * 2.7 + p.y * 1.9 - time * 1.4;
        float b = p.x * 0.96 - p.y * 4.8 + time * 2.1;
        float wobble = grain(vec3(p * 0.25, time * 0.18));
        vec3 N = normalize(vec3(0.052*cos(a) + 0.037*cos(b), 1.0, 0.05*cos(a) - 0.09*cos(b)));
        vec3 V = normalize(cameraPosition - waterPosition);
        vec3 L = normalize(vec3(-0.65, 0.36, 0.50));
        float fresnel = pow(1.0 - max(0.0, dot(N,V)), 3.5);
        float sun = pow(max(0.0, dot(reflect(-L,N), V)), 72.0);
        vec3 color = mix(vec3(0.025, 0.095, 0.077), vec3(0.31, 0.42, 0.47), fresnel);
        float riffle = smoothstep(0.49, 0.94, sin(a + 6.0 * wobble) * 0.5 + 0.5);
        color += 0.035 * wobble + 0.052 * riffle + vec3(1.0, 0.72, 0.34) * sun * 0.6;
        gl_FragColor = vec4(color, mix(0.79, 0.97, fresnel));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}
