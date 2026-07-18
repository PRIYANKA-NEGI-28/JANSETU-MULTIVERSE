import { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'none';
  delay?: number; // in milliseconds
  duration?: number; // in milliseconds
}

export default function ScrollReveal({
  children,
  className = '',
  direction = 'up',
  delay = 0,
  duration,
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Bypass animations if user prefers reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      {
        threshold: 0.05, // trigger early for immediate visual feedback
        rootMargin: '0px 0px -40px 0px', // trigger slightly before entering viewport
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  const animClasses = {
    up: 'animate-fade-up',
    down: 'animate-fade-down',
    left: 'animate-fade-left',
    right: 'animate-fade-right',
    scale: 'animate-scale',
    none: 'transition-opacity duration-300 opacity-100',
  };

  const animationClass = animClasses[direction];
  const delayStyle = delay ? `${delay}ms` : undefined;
  const durationStyle = duration ? `${duration}ms` : undefined;

  const style: React.CSSProperties = {
    animationDelay: delayStyle,
    animationDuration: durationStyle,
    animationFillMode: 'forwards',
  };

  return (
    <div
      ref={ref}
      className={`${isVisible ? animationClass : 'opacity-0'} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
