import React, { useRef, useEffect, useState } from "react";

interface VideoScrubberProps {
  scrollProgress: number;
  src?: string; // Kept for compatibility, but ignored
}

export default function VideoScrubber({ scrollProgress }: VideoScrubberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetProgressRef = useRef(scrollProgress);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  
  const totalFrames = 53;

  useEffect(() => {
    // Preload all frames
    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;
    
    for (let i = 1; i <= totalFrames; i++) {
        const img = new Image();
        const frameNumber = i.toString().padStart(4, '0');
        img.src = `/satellite-frames/frame_${frameNumber}.webp`;
        img.onload = () => {
            loadedCount++;
            setImagesLoaded(loadedCount);
        };
        loadedImages.push(img);
    }
    imagesRef.current = loadedImages;
  }, []);

  useEffect(() => {
    targetProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    let frameId: number;
    let smoothProgress = targetProgressRef.current;
    
    const updateFrame = () => {
      smoothProgress += (targetProgressRef.current - smoothProgress) * 0.15;
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx && imagesRef.current.length === totalFrames) {
         // Frame index calculation
         let frameIndex = Math.floor(smoothProgress * (totalFrames - 1));
         if (frameIndex < 0) frameIndex = 0;
         if (frameIndex >= totalFrames) frameIndex = totalFrames - 1;

         const currentImg = imagesRef.current[frameIndex];
         
         if (currentImg && currentImg.complete && currentImg.naturalWidth !== 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw image covering bounds logically
            const canvasAspect = canvas.width / canvas.height;
            const imgAspect = currentImg.width / currentImg.height;
            let drawWidth = canvas.width;
            let drawHeight = canvas.height;
            let offsetX = 0;
            let offsetY = 0;

            if (canvasAspect > imgAspect) {
                drawWidth = canvas.height * imgAspect;
                offsetX = (canvas.width - drawWidth) / 2;
            } else {
                drawHeight = canvas.width / imgAspect;
                offsetY = (canvas.height - drawHeight) / 2;
            }

            ctx.drawImage(currentImg, offsetX, offsetY, drawWidth, drawHeight);
         }
      }
      
      frameId = requestAnimationFrame(updateFrame);
    };
    
    frameId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-10 bg-transparent">
      {imagesLoaded < totalFrames && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-transparent">
          <div className="text-gray-400 font-mono text-sm uppercase tracking-widest animate-pulse">
            Loading... {Math.round((imagesLoaded / totalFrames) * 100)}%
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
