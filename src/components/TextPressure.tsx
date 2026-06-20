import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const getAttr = (distance: number, maxDist: number, minVal: number, maxVal: number) => {
  const val = maxVal - Math.abs((maxVal * distance) / maxDist);
  return Math.max(minVal, val + minVal);
};

const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: any;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

interface TextPressureProps {
  text?: string;
  fontFamily?: string;
  fontUrl?: string;
  width?: boolean;
  weight?: boolean;
  italic?: boolean;
  alpha?: boolean;
  flex?: boolean;
  stroke?: boolean;
  scale?: boolean;
  textColor?: string;
  strokeColor?: string;
  className?: string;
  minFontSize?: number;
  scrollDriven?: boolean; // Custom prop to support scroll-driven variations
}

const TextPressure: React.FC<TextPressureProps> = ({
  text = 'SRINIVASA',
  fontFamily = 'Compressa VF',
  fontUrl = '/CompressaPRO-GX.woff2',

  width = true,
  weight = true,
  italic = true,
  alpha = false,

  flex = true,
  stroke = false,
  scale = false,

  textColor = '#FFFFFF',
  strokeColor = '#FF0000',
  className = '',

  minFontSize = 24,
  scrollDriven = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const spansRef = useRef<(HTMLSpanElement | null)[]>([]);

  const mouseRef = useRef({ x: 0, y: 0 });
  const cursorRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef<number>(0);

  const [fontSize, setFontSize] = useState(minFontSize);
  const [scaleY, setScaleY] = useState(1);
  const [lineHeight, setLineHeight] = useState(1);

  const chars = text.split('');

  useEffect(() => {
    // Scroll-driven tracking
    const scroller = document.querySelector('.landing-scroller') || window;
    
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Determine how far the element is from the center of the viewport
        const elementCenter = rect.top + rect.height / 2;
        const screenCenter = viewportHeight / 2;
        const offset = (elementCenter - screenCenter) / (viewportHeight / 2);
        scrollRef.current = Math.max(-1, Math.min(1, offset));
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollDriven) {
        cursorRef.current.x = e.clientX;
        cursorRef.current.y = e.clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!scrollDriven && e.touches.length > 0) {
        const t = e.touches[0];
        cursorRef.current.x = t.clientX;
        cursorRef.current.y = t.clientY;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    if (containerRef.current) {
      const { left, top, width: w, height: h } = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = left + w / 2;
      mouseRef.current.y = top + h / 2;
      cursorRef.current.x = mouseRef.current.x;
      cursorRef.current.y = mouseRef.current.y;
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      scroller.removeEventListener('scroll', handleScroll);
    };
  }, [scrollDriven]);

  const setSize = useCallback(() => {
    if (!containerRef.current || !titleRef.current) return;

    const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect();

    let newFontSize = containerW / (chars.length / 1.6);
    newFontSize = Math.max(newFontSize, minFontSize);

    setFontSize(newFontSize);
    setScaleY(1);
    setLineHeight(1);

    requestAnimationFrame(() => {
      if (!titleRef.current) return;
      const textRect = titleRef.current.getBoundingClientRect();

      if (scale && textRect.height > 0) {
        const yRatio = containerH / textRect.height;
        setScaleY(yRatio);
        setLineHeight(yRatio);
      }
    });
  }, [chars.length, minFontSize, scale]);

  useEffect(() => {
    const debouncedSetSize = debounce(setSize, 100);
    debouncedSetSize();
    window.addEventListener('resize', debouncedSetSize);
    return () => window.removeEventListener('resize', debouncedSetSize);
  }, [setSize]);

  useEffect(() => {
    let rafId: number;
    let localTime = 0;
    let isVisible = false;

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible) {
        animate();
      } else {
        cancelAnimationFrame(rafId);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const animate = () => {
      if (!isVisible) return;
      localTime += 0.01;
      
      // Interpolate towards the scroll-based/mouse positions
      if (scrollDriven) {
        // Map scroll percentage to beautiful wave patterns
        const s = scrollRef.current; // ranges -1 to 1
        const intensity = Math.abs(s); // high at edges, low at center

        spansRef.current.forEach((span, i) => {
          if (!span) return;
          
          // Custom beautiful wave based on character index, scroll, and time
          const charOffset = i / chars.length;
          const wave = Math.sin(localTime * 1.5 + charOffset * Math.PI * 2) * 0.5 + 0.5;
          
          // Width variation (min: 5, max: 200)
          const wdth = width 
            ? Math.floor(5 + (195 * (1 - intensity)) + Math.sin(localTime * 2 + i) * 15) 
            : 100;
          
          // Weight variation (min: 100, max: 900)
          const wght = weight 
            ? Math.floor(100 + (800 * (1 - intensity)) + wave * 200) 
            : 400;
            
          // Italic variation (min: 0, max: 1)
          const italVal = italic 
            ? (Math.max(0, Math.min(1, intensity * 0.8 + wave * 0.2))).toFixed(2) 
            : '0';
            
          const alphaVal = alpha 
            ? (0.3 + 0.7 * (1 - intensity)).toFixed(2) 
            : '1';

          const newFontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${italVal}`;

          if (span.style.fontVariationSettings !== newFontVariationSettings) {
            span.style.fontVariationSettings = newFontVariationSettings;
          }
          if (alpha && span.style.opacity !== alphaVal) {
            span.style.opacity = alphaVal;
          }
        });
      } else {
        mouseRef.current.x += (cursorRef.current.x - mouseRef.current.x) / 15;
        mouseRef.current.y += (cursorRef.current.y - mouseRef.current.y) / 15;

        if (titleRef.current) {
          const titleRect = titleRef.current.getBoundingClientRect();
          const maxDist = titleRect.width / 2;

          spansRef.current.forEach(span => {
            if (!span) return;

            const rect = span.getBoundingClientRect();
            const charCenter = {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2
            };

            const d = dist(mouseRef.current, charCenter);

            const wdth = width ? Math.floor(getAttr(d, maxDist, 5, 200)) : 100;
            const wght = weight ? Math.floor(getAttr(d, maxDist, 100, 900)) : 400;
            const italVal = italic ? getAttr(d, maxDist, 0, 1).toFixed(2) : '0';
            const alphaVal = alpha ? getAttr(d, maxDist, 0, 1).toFixed(2) : '1';

            const newFontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${italVal}`;

            if (span.style.fontVariationSettings !== newFontVariationSettings) {
              span.style.fontVariationSettings = newFontVariationSettings;
            }
            if (alpha && span.style.opacity !== alphaVal) {
              span.style.opacity = alphaVal;
            }
          });
        }
      }

      rafId = requestAnimationFrame(animate);
    };

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [width, weight, italic, alpha, scrollDriven, chars.length]);

  const styleElement = useMemo(() => {
    return (
      <style>{`
        @font-face {
          font-family: '${fontFamily}';
          src: url('${fontUrl}');
          font-style: normal;
        }

        .text-pressure-flex {
          display: flex;
          justify-content: space-between;
        }

        .text-pressure-stroke span {
          position: relative;
          color: ${textColor};
        }
        .text-pressure-stroke span::after {
          content: attr(data-char);
          position: absolute;
          left: 0;
          top: 0;
          color: transparent;
          z-index: -1;
          -webkit-text-stroke-width: 3px;
          -webkit-text-stroke-color: ${strokeColor};
        }

        .text-pressure-title {
          color: ${textColor};
        }
      `}</style>
    );
  }, [fontFamily, fontUrl, textColor, strokeColor, stroke]);

  const dynamicClassName = [
    className,
    flex ? 'text-pressure-flex' : '',
    stroke ? 'text-pressure-stroke' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'transparent'
      }}
    >
      {styleElement}
      <h1
        ref={titleRef}
        className={`text-pressure-title ${dynamicClassName}`}
        style={{
          fontFamily,
          textTransform: 'uppercase',
          fontSize: fontSize,
          lineHeight,
          transform: `scale(1, ${scaleY})`,
          transformOrigin: 'center top',
          margin: 0,
          textAlign: 'center',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          fontWeight: 100,
          width: '100%'
        }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            ref={el => { spansRef.current[i] = el; }}
            data-char={char}
            style={{
              display: 'inline-block',
              color: stroke ? undefined : textColor
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </h1>
    </div>
  );
};

export default TextPressure;
