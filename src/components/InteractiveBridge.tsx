import React from "react";
import UnicornScene from "unicornstudio-react";

interface InteractiveBridgeProps {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export default function InteractiveBridge({ scrollRef }: InteractiveBridgeProps) {
  return (
    <>
      {/* Pitch black screen transition area */}
      <div className="w-full h-[150vh] bg-black" />
      
      {/* The component that comes into view */}
      <section className="relative w-full overflow-hidden bg-black flex flex-col items-center justify-center z-10 h-[120vh] min-h-[800px]">
        <div className="w-full h-full relative z-10 unicorn-container mix-blend-screen">
          <UnicornScene 
            projectId="cJ085ZPZApHISv410A43" 
            sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.5/dist/unicornStudio.umd.js"
            width="100%" 
            height="100%" 
          />
        </div>
      </section>
      
      {/* Post-transition space to allow it to be fully visible before next section */}
      <div className="w-full h-[50vh] bg-black" />
    </>
  );
}
