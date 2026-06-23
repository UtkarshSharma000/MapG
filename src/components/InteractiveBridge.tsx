import React from "react";
import UnicornScene from "unicornstudio-react";

export default function InteractiveBridge() {
  return (
    <section className="relative w-full overflow-hidden bg-[#050505] flex flex-col items-center justify-center z-10 border-t border-b border-white/5 h-[80vh] min-h-[600px]">
      <div className="w-full h-full relative z-10 unicorn-container opacity-100 mix-blend-screen">
        <UnicornScene 
          projectId="cJ085ZPZApHISv410A43" 
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.5/dist/unicornStudio.umd.js"
          width="100%" 
          height="100%" 
          production={true}
          lazyLoad={true}
          scale={0.5}
          // @ts-ignore
          dpi={1}
        />
      </div>
    </section>
  );
}
