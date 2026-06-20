import React from "react";
import UnicornScene from "unicornstudio-react";
import { motion } from "motion/react";

interface InteractiveBridgeProps {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export default function InteractiveBridge({ scrollRef }: InteractiveBridgeProps) {
  return (
    <>
      {/* Long black transition area */}
      <div 
        className="w-full h-[150vh]" 
        style={{
          background: 'linear-gradient(to bottom, #25130d, #23130c, #000000)'
        }}
      />
      
      {/* The component that fades into view */}
      <section className="relative w-full overflow-hidden bg-[#000000] flex flex-col items-center justify-center z-10 h-[120vh] min-h-[800px]">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          viewport={{ root: scrollRef, once: false, amount: 0.3, margin: "100px" }}
          className="w-full h-full relative z-10 unicorn-container mix-blend-screen"
        >
          <UnicornScene 
            projectId="cJ085ZPZApHISv410A43" 
            sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.5/dist/unicornStudio.umd.js"
            width="100%" 
            height="100%" 
          />
        </motion.div>
      </section>
      
      {/* Post-transition space to allow it to be fully visible before next section */}
      <div className="w-full h-[50vh] bg-[#000000]" />
    </>
  );
}
