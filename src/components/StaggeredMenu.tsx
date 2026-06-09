import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuProps {
  items: Array<{ label: string, onClick?: () => void, link?: string, image?: string }>;
  position?: 'left' | 'right';
  onLaunchCore?: () => void;
  [key: string]: any;
}

export default function StaggeredMenu({ items, position = 'right' }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`fixed top-8 ${position === 'right' ? 'right-8' : 'left-8'} z-[100]`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full border-2 border-primary-fixed bg-black/50 backdrop-blur-sm text-primary-fixed flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,176,0,0.2)]"
      >
        <span className="material-symbols-outlined">{isOpen ? 'close' : 'menu'}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, x: position === 'right' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: position === 'right' ? 20 : -20 }}
            className={`absolute top-16 ${position === 'right' ? 'right-0' : 'left-0'} flex flex-col gap-3 w-56`}
          >
            {items.map((item, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: position === 'right' ? 20 : -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: position === 'right' ? 20 : -20 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => {
                    if (item.onClick) item.onClick();
                    setIsOpen(false);
                }}
                className={`p-4 bg-black/80 backdrop-blur-md border border-white/10 text-white hover:border-primary-fixed hover:bg-primary-fixed hover:text-black transition-all rounded shadow-xl text-xs font-bold tracking-widest uppercase ${position === 'right' ? 'text-right' : 'text-left'}`}
              >
                {item.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
