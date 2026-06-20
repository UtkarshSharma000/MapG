import React, { useRef, useEffect } from 'react';

const Prism: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      time += 0.003;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const cx = width / 2;
      const cy = height * 0.85;

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      // Add a subtle mesh grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      ctx.globalCompositeOperation = 'screen';

      // Draw light rays from the bottom center
      const rays = 24;
      for (let i = 0; i < rays; i++) {
        const offset = Math.sin(time + i * 0.3) * 0.15;
        const angle = Math.PI + (Math.PI * (i / (rays - 1))) + offset;
        const length = height * (1.2 + Math.cos(time * 2 + i) * 0.2);
        
        ctx.beginPath();
        const thickness = 0.08 + Math.sin(time + i) * 0.04;
        
        ctx.moveTo(cx, cy);
        
        // Use a slight curve for the triangle
        ctx.lineTo(
           cx + Math.cos(angle - thickness) * length,
           cy + Math.sin(angle - thickness) * length
        );
        ctx.lineTo(
           cx + Math.cos(angle + thickness) * length,
           cy + Math.sin(angle + thickness) * length
        );
        ctx.closePath();

        const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
        const hue = 30 + i * 2 + Math.sin(time)*10;
        
        grad.addColorStop(0, `hsla(${hue}, 100%, 60%, ${0.15 + Math.sin(time*3+i)*0.05})`);
        grad.addColorStop(0.5, `hsla(${hue + 10}, 100%, 50%, ${0.05})`);
        grad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Draw horizontal lens flare at the bottom
      const flareGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.6);
      flareGrad.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
      flareGrad.addColorStop(0.1, 'rgba(255, 100, 0, 0.1)');
      flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = flareGrad;
      ctx.fillRect(0, 0, width, height);
      
      const horizontalFlare = ctx.createLinearGradient(0, cy, width, cy);
      horizontalFlare.addColorStop(0, 'rgba(0,0,0,0)');
      horizontalFlare.addColorStop(0.3, 'rgba(255, 120, 0, 0.1)');
      horizontalFlare.addColorStop(0.5, 'rgba(255, 200, 150, 0.8)');
      horizontalFlare.addColorStop(0.7, 'rgba(255, 120, 0, 0.1)');
      horizontalFlare.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = horizontalFlare;
      ctx.fillRect(0, cy - 2, width, 4);

      ctx.globalCompositeOperation = 'source-over';

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default Prism;
