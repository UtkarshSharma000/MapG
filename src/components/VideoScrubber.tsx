import React, { useRef, useEffect } from "react";

interface VideoScrubberProps {
  scrollProgress: number;
  src: string;
}

export default function VideoScrubber({ scrollProgress, src }: VideoScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      const targetTime = scrollProgress * video.duration;
      if (isFinite(targetTime)) {
        video.currentTime = targetTime;
      }
    }
  }, [scrollProgress]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
        // init
        video.currentTime = scrollProgress * video.duration;
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-10 mix-blend-multiply">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
      />
    </div>
  );
}
