import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import './Galaxy.css';

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform bool uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform bool uTransparent;
uniform float uScrollProgress;

varying vec2 vUv;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= uResolution.x / uResolution.y;

    float n = fbm(p * 0.8 + uTime * 0.05);
    vec3 color1 = vec3(0.005, 0.008, 0.015); 
    vec3 color2 = vec3(0.01, 0.02, 0.04); 
    vec3 color3 = vec3(0.02, 0.035, 0.06);  

    vec3 finalColor = mix(color1, color2, fbm(p + uTime * 0.02));
    finalColor = mix(finalColor, color3, fbm(p * 1.5 - uTime * 0.03));
    
    float glow = pow(n, 3.0) * 1.5;
    finalColor += glow * vec3(0.3, 0.5, 0.8) * 0.3;

    float stars = pow(hash(uv + floor(uTime * 0.0001)), 500.0);
    stars += pow(hash(uv * 1.2 + 0.5), 1000.0) * (0.5 + 0.5 * sin(uTime + hash(uv)*10.0));
    finalColor += stars * 0.8;

    vec2 mouse = uMouse;
    float mouseGlow = 0.05 / (length(uv - mouse) + 0.01);
    finalColor += mouseGlow * vec3(0.4, 0.6, 1.0) * 0.15 * uMouseActiveFactor;

    vec3 col = finalColor;

    // Render Interactive Solar System
    vec3 solarCol = vec3(0.0);
    float sProgress = uScrollProgress;
    if (sProgress > 0.01) {
      vec2 focalPx = uFocal * uResolution.xy;
      vec2 solUV = (vUv * uResolution.xy - focalPx) / uResolution.y;
      vec2 mouseNorm = uMouse - vec2(0.5);

      if (uAutoCenterRepulsion > 0.0) {
        vec2 centerUV = vec2(0.0, 0.0);
        float centerDist = length(solUV - centerUV);
        vec2 repulsion = normalize(solUV - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));
        solUV += repulsion * 0.05;
      } else if (uMouseRepulsion) {
        vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
        float mouseDist = length(solUV - mousePosUV);
        vec2 repulsion = normalize(solUV - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
        solUV += repulsion * 0.05 * uMouseActiveFactor;
      } else {
        vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
        solUV += mouseOffset;
      }

      // Camera Zoom Out cinematic effect as you scroll
      float zoom = 1.0 + sProgress * 4.5;
      solUV *= zoom;

      float autoRotAngle = uTime * uRotationSpeed;
      mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
      solUV = autoRot * solUV;

      solUV = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * solUV;

      float d = length(solUV);
      
      // 1. Central Core Sun
      float sunGlow = 0.12 / (d + 0.04);
      solarCol += vec3(1.0, 0.82, 0.35) * sunGlow * smoothstep(0.0, 0.3, sProgress);
      
      // Orbit 1 (Mercury)
      {
        float r = 0.35;
        float ring = smoothstep(3.0 / uResolution.y * zoom, 0.0, abs(d - r) - 0.001);
        solarCol += vec3(0.4, 0.65, 1.0) * ring * 0.35 * sProgress;
        
        float angle = uTime * 1.5 + 1.2;
        vec2 pPos = vec2(cos(angle), sin(angle)) * r;
        float pGlow = 0.005 / (length(solUV - pPos) + 0.004);
        solarCol += vec3(0.5, 0.75, 1.0) * pGlow * sProgress;
      }
      
      // Orbit 2 (Venus)
      {
        float r = 0.7;
        float ring = smoothstep(3.0 / uResolution.y * zoom, 0.0, abs(d - r) - 0.001);
        solarCol += vec3(0.85, 0.55, 0.3) * ring * 0.3 * sProgress;
        
        float angle = uTime * 0.95 + 2.8;
        vec2 pPos = vec2(cos(angle), sin(angle)) * r;
        float pGlow = 0.007 / (length(solUV - pPos) + 0.005);
        solarCol += vec3(0.9, 0.6, 0.4) * pGlow * sProgress;
      }
      
      // Orbit 3 (Earth & Moon)
      {
        float r = 1.1;
        float ring = smoothstep(3.0 / uResolution.y * zoom, 0.0, abs(d - r) - 0.0012);
        solarCol += vec3(0.0, 0.65, 1.0) * ring * 0.4 * sProgress;
        
        float angle = uTime * 0.55 + 4.5;
        vec2 pPos = vec2(cos(angle), sin(angle)) * r;
        float pGlow = 0.012 / (length(solUV - pPos) + 0.008);
        
        // Orbiting Moon
        float mAngle = uTime * 2.8;
        vec2 mPos = pPos + vec2(cos(mAngle), sin(mAngle)) * 0.055;
        float mGlow = 0.0035 / (length(solUV - mPos) + 0.003);
        
        solarCol += vec3(0.2, 0.75, 1.0) * pGlow * sProgress;
        solarCol += vec3(0.85, 0.85, 0.88) * mGlow * sProgress;
      }
      
      // Orbit 4 (Mars)
      {
        float r = 1.6;
        float ring = smoothstep(3.0 / uResolution.y * zoom, 0.0, abs(d - r) - 0.001);
        solarCol += vec3(1.0, 0.4, 0.2) * ring * 0.35 * sProgress;
        
        float angle = uTime * 0.35 + 0.5;
        vec2 pPos = vec2(cos(angle), sin(angle)) * r;
        float pGlow = 0.007 / (length(solUV - pPos) + 0.005);
        solarCol += vec3(1.0, 0.42, 0.25) * pGlow * sProgress;
      }
      
      // Orbit 5 (Jupiter)
      {
        float r = 2.2;
        float ring = smoothstep(3.0 / uResolution.y * zoom, 0.0, abs(d - r) - 0.0015);
        solarCol += vec3(0.9, 0.75, 0.5) * ring * 0.25 * sProgress;
        
        float angle = uTime * 0.18 + 3.1;
        vec2 pPos = vec2(cos(angle), sin(angle)) * r;
        float pGlow = 0.015 / (length(solUV - pPos) + 0.01);
        solarCol += vec3(0.9, 0.75, 0.5) * pGlow * sProgress;
      }
    }
    
    col += solarCol;

    if (uTransparent) {
        float alpha = length(col);
        alpha = smoothstep(0.0, 0.3, alpha);
        alpha = min(alpha, 1.0);
        gl_FragColor = vec4(col, alpha);
    } else {
        gl_FragColor = vec4(col, 1.0);
    }
}
`;

export default function Galaxy({
  focal = [0.5, 0.5],
  rotation = [1.0, 0.0],
  starSpeed = 0.5,
  density = 1,
  hueShift = 140,
  disableAnimation = false,
  speed = 1.0,
  mouseInteraction = true,
  glowIntensity = 0.3,
  saturation = 0.0,
  mouseRepulsion = true,
  repulsionStrength = 2,
  twinkleIntensity = 0.3,
  rotationSpeed = 0.1,
  autoCenterRepulsion = 0,
  transparent = true,
  scrollProgressRef,
  ...rest
}: any) {
  const ctnDom = useRef<HTMLDivElement>(null);
  const targetMousePos = useRef({ x: 0.5, y: 0.5 });
  const smoothMousePos = useRef({ x: 0.5, y: 0.5 });
  const targetMouseActive = useRef(0.0);
  const smoothMouseActive = useRef(0.0);
  
  // We don't need a local scrollProgressRef if one is passed from the parent. 
  // If one is not passed, use a default ref.
  const localScrollProgressRef = useRef(0);
  const activeScrollRef = scrollProgressRef || localScrollProgressRef;

  const focalX = focal && focal.length === 2 ? focal[0] : 0.5;
  const focalY = focal && focal.length === 2 ? focal[1] : 0.5;
  const rotX = rotation && rotation.length === 2 ? rotation[0] : 1.0;
  const rotY = rotation && rotation.length === 2 ? rotation[1] : 0.0;

  useEffect(() => {
    if (!ctnDom.current) return;
    const ctn = ctnDom.current;
    const renderer = new Renderer({
      alpha: transparent,
      premultipliedAlpha: false
    });
    const gl = renderer.gl;

    if (transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(0, 0, 0, 1);
    }

    let program: any;

    function resize() {
      const scale = 1;
      renderer.setSize(ctn.offsetWidth * scale, ctn.offsetHeight * scale);
      if (program) {
        program.uniforms.uResolution.value = new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height
        );
      }
    }
    window.addEventListener('resize', resize, false);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
        },
        uFocal: { value: new Float32Array([focalX, focalY]) },
        uRotation: { value: new Float32Array([rotX, rotY]) },
        uStarSpeed: { value: starSpeed },
        uDensity: { value: density },
        uHueShift: { value: hueShift },
        uSpeed: { value: speed },
        uMouse: {
          value: new Float32Array([smoothMousePos.current.x, smoothMousePos.current.y])
        },
        uGlowIntensity: { value: glowIntensity },
        uSaturation: { value: saturation },
        uMouseRepulsion: { value: mouseRepulsion },
        uTwinkleIntensity: { value: twinkleIntensity },
        uRotationSpeed: { value: rotationSpeed },
        uRepulsionStrength: { value: repulsionStrength },
        uMouseActiveFactor: { value: 0.0 },
        uAutoCenterRepulsion: { value: autoCenterRepulsion },
        uTransparent: { value: transparent },
        uScrollProgress: { value: 0 }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });
    let animateId: number;

    function update(t: number) {
      animateId = requestAnimationFrame(update);
      if (program) {
        program.uniforms.uScrollProgress.value = activeScrollRef.current;
      }
      if (!disableAnimation) {
        program.uniforms.uTime.value = t * 0.001;
        program.uniforms.uStarSpeed.value = (t * 0.001 * starSpeed) / 10.0;
      }

      const lerpFactor = 0.05;
      smoothMousePos.current.x += (targetMousePos.current.x - smoothMousePos.current.x) * lerpFactor;
      smoothMousePos.current.y += (targetMousePos.current.y - smoothMousePos.current.y) * lerpFactor;

      smoothMouseActive.current += (targetMouseActive.current - smoothMouseActive.current) * lerpFactor;

      program.uniforms.uMouse.value[0] = smoothMousePos.current.x;
      program.uniforms.uMouse.value[1] = smoothMousePos.current.y;
      program.uniforms.uMouseActiveFactor.value = smoothMouseActive.current;

      renderer.render({ scene: mesh });
    }
    animateId = requestAnimationFrame(update);
    ctn.appendChild(gl.canvas);

    function handleMouseMove(e: any) {
      targetMousePos.current = {
         x: e.clientX / window.innerWidth,
         y: 1.0 - (e.clientY / window.innerHeight)
      };
      targetMouseActive.current = 1.0;
    }

    function handleMouseLeave() {
      targetMouseActive.current = 0.0;
    }

    if (mouseInteraction) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('mouseout', handleMouseLeave);
    }

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener('resize', resize);
      if (mouseInteraction) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('mouseout', handleMouseLeave);
      }
      if (ctn.contains(gl.canvas)) {
         ctn.removeChild(gl.canvas);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    focalX,
    focalY,
    rotX,
    rotY,
    starSpeed,
    density,
    hueShift,
    disableAnimation,
    speed,
    mouseInteraction,
    glowIntensity,
    saturation,
    mouseRepulsion,
    twinkleIntensity,
    rotationSpeed,
    repulsionStrength,
    autoCenterRepulsion,
    transparent
  ]);

  return <div ref={ctnDom} className="galaxy-container" {...rest} />;
}
