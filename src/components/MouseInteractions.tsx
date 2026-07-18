import { useState, useRef, useEffect } from 'react';

// Utility helper to check for touch devices
const useIsTouch = () => {
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        window.matchMedia('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
      );
    };
    checkTouch();
  }, []);

  return isTouch;
};

/* ==========================================================================
   Magnetic Button Wrapper (Desktop Only)
   ========================================================================== */
interface MagneticProps {
  children: React.ReactElement;
  range?: number; // Distance threshold in pixels
  strength?: number; // How strongly it pulls (0.1 to 0.5)
}

export function Magnetic({ children, range = 60, strength = 0.35 }: MagneticProps) {
  const isTouch = useIsTouch();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTouch || !ref.current) return;

    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;
    const distance = Math.hypot(distanceX, distanceY);

    if (distance < range) {
      // Pull toward cursor
      setPosition({
        x: distanceX * strength,
        y: distanceY * strength,
      });
    } else {
      // Release outside range
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const style: React.CSSProperties = {
    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
    transition: position.x === 0 ? 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 100ms ease-out',
    display: 'inline-block',
  };

  if (isTouch) return children;

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   3D Tilt Card Wrapper (Desktop Only)
   ========================================================================== */
interface TiltProps {
  children: React.ReactNode;
  className?: string;
  maxRotate?: number; // Max rotation degrees
}

export function Tilt({ children, className = '', maxRotate = 6 }: TiltProps) {
  const isTouch = useIsTouch();
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTouch || !ref.current) return;

    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;

    // Calculate rotation (-maxRotate to maxRotate degrees)
    const rotateY = ((x / width) - 0.5) * maxRotate * 2;
    const rotateX = (0.5 - (y / height)) * maxRotate * 2;

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: 'transform 100ms ease-out',
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
    });
  };

  if (isTouch) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        ...style,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Dynamic Follow Glow Highlight (Desktop Only)
   ========================================================================== */
interface CursorGlowProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string; // CSS Color e.g., 'rgba(249, 115, 22, 0.12)'
}

export function CursorGlow({ children, className = '', glowColor = 'rgba(249, 115, 22, 0.15)' }: CursorGlowProps) {
  const isTouch = useIsTouch();
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTouch || !ref.current) return;
    const { clientX, clientY } = e;
    const { left, top } = ref.current.getBoundingClientRect();
    setCoords({
      x: clientX - left,
      y: clientY - top,
    });
  };

  if (isTouch) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden ${className}`}
    >
      {isHovered && (
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            left: coords.x,
            top: coords.y,
            width: '350px',
            height: '350px',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            transition: 'opacity 150ms ease',
            zIndex: 0,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
