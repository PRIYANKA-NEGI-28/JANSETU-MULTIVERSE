import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

export interface ScrollRevealProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'none';
  readonly delay?: number;
  readonly duration?: number;
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
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      {
        threshold: 0.05,
        rootMargin: '0px 0px -40px 0px',
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

  const style: CSSProperties = {
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
