import React, { useEffect, useRef } from 'react';

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      if (!canvas) return;
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    
    // Initial sync
    syncSize();
    window.addEventListener('resize', syncSize);

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const vertexShaderSrc = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSrc = `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;

      void main() {
        vec2 uv = (v_uv - 0.5) * 2.0;
        uv.x *= u_resolution.x / u_resolution.y;

        // Dark amber/charcoal background
        vec3 col = vec3(0.05, 0.02, 0.0);

        if (uv.y < 0.0) {
          float depth = abs(1.0 / uv.y);
          vec2 groundUv = vec2(uv.x * depth, depth);
          groundUv.y -= u_time * 2.0;

          vec2 grid = fract(groundUv);
          float lineDist = min(grid.x, grid.y);
          lineDist = min(lineDist, min(1.0 - grid.x, 1.0 - grid.y));

          float thickness = max(0.05 / depth, 0.01);
          float glow = smoothstep(thickness * 2.0, 0.0, lineDist);
          float fade = exp(-depth * 0.2);

          // Kinetic Amber theme grid lines (#72ff70 fallback but they wanted amber theme according to summary, let's use the provided primary-fixed: #72ff70 (it's lime actually, despite summary saying amber. the color provided was #72ff70))
          col = mix(col, vec3(0.45, 1.0, 0.44), glow * fade); 
        }
        else {
          float distToCenter = length(uv - vec2(0.0, 0.2));
          float sunMask = step(distToCenter, 0.4);

          if (sunMask > 0.5) {
            vec3 sunTopCol = vec3(1.0, 1.0, 0.6);
            vec3 sunBotCol = vec3(0.45, 1.0, 0.44);

            float sunUvY = (uv.y - (-0.2)) / 0.8;
            vec3 sunCol = mix(sunBotCol, sunTopCol, clamp(sunUvY, 0.0, 1.0));

            float cutStripes = fract((uv.y - u_time * 0.1) * 10.0);
            float cutThickness = mix(0.4, 0.05, clamp(sunUvY, 0.0, 1.0));
            if (cutStripes < cutThickness) {
               col = vec3(0.05, 0.02, 0.0); // Match background
            } else {
               col = sunCol;
            }
          } else {
            float star = fract(sin(dot(floor(uv * 100.0), vec2(12.9898, 78.233))) * 43758.5453);
            if (star > 0.995) {
               col += vec3(1.0);
            }
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function compileShader(type: number, source: string) {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vShader = compileShader(gl.VERTEX_SHADER, vertexShaderSrc);
    const fShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);

    if (!vShader || !fShader) return;

    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const a_position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

    const u_time = gl.getUniformLocation(program, 'u_time');
    const u_resolution = gl.getUniformLocation(program, 'u_resolution');
    
    let animationFrameId: number;

    function render(time: number) {
      if (!gl) return;
      syncSize();
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      gl.uniform1f(u_time, time * 0.001);
      gl.uniform2f(u_resolution, gl.canvas.width, gl.canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    }
    
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', syncSize);
      if (gl) {
         gl.deleteProgram(program);
         gl.deleteShader(vShader);
         gl.deleteShader(fShader);
         gl.deleteBuffer(buffer);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full" style={{display: 'block', zIndex: 0, opacity: 0.8}}>
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}}></canvas>
    </div>
  );
}
