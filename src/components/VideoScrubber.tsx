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
      const video = videoRef.current;
      if (video) {
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
        className="w-full h-full object-contain"
        muted
        playsInline
        preload="auto"
        onLoadedData={handleLoadedData}
      />
    </div>
  );
}
