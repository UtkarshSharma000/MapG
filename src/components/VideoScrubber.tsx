import React, { useRef, useEffect } from "react";

interface VideoScrubberProps {
  scrollProgress: number;
  src: string;
}

export default function VideoScrubber({ scrollProgress, src }: VideoScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTimeRef = useRef(0);
  const currentVideoTimeRef = useRef(0);
  const targetProgressRef = useRef(scrollProgress);
  const smoothScrollRef = useRef(scrollProgress);

  useEffect(() => {
    targetProgressRef.current = scrollProgress;
    const video = videoRef.current;
    if (video && video.duration && !isNaN(video.duration)) {
      targetTimeRef.current = scrollProgress * video.duration;
    }
  }, [scrollProgress]);

  useEffect(() => {
    let frameId: number;
    
    const updateFrame = () => {
      smoothScrollRef.current += (targetProgressRef.current - smoothScrollRef.current) * 0.06;
      
      const video = videoRef.current;
      if (video) {
         const s = smoothScrollRef.current;
         
         // Dynamic Camera (Scale, Pan, Tilt)
         const scale = 1.0 + s * 0.5;
         const tx = s * -3;
         const ty = s * 6;
         const r = s * -2;
         video.style.transform = `scale(${scale}) translate(${tx}%, ${ty}%) rotate(${r}deg)`;

         // Smooth Video Seek
         if (video.readyState >= 2 && video.duration) {
           currentVideoTimeRef.current += (targetTimeRef.current - currentVideoTimeRef.current) * 0.12;
           if (Math.abs(video.currentTime - currentVideoTimeRef.current) > 0.03) {
               video.currentTime = currentVideoTimeRef.current;
           }
         }
      }
      
      frameId = requestAnimationFrame(updateFrame);
    };
    
    frameId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleLoadedData = () => {
    const video = videoRef.current;
    if (video && video.duration) {
        video.currentTime = targetProgressRef.current * video.duration;
        targetTimeRef.current = video.currentTime;
        currentVideoTimeRef.current = video.currentTime;
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-10 bg-white">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain origin-center"
        style={{ willChange: 'transform' }}
        muted
        playsInline
        preload="auto"
        onLoadedData={handleLoadedData}
      />
    </div>
  );
}
