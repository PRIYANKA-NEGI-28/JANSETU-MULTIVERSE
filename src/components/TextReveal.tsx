import { useEffect, useRef, useState } from 'react';

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number; // Base delay in milliseconds
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
}

export default function TextReveal({ text, className = '', delay = 0, as = 'h1' }: TextRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
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
      { threshold: 0.05 }
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

  const words = text.split(' ');
  const Tag = as;

  return (
    <Tag ref={ref as any} className={`${className} flex flex-wrap items-center justify-center`}>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden mr-[0.25em] py-[0.1em]"
        >
          <span
            className={`inline-block transition-all duration-[600ms] ease-out ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[110%] opacity-0'
            }`}
            style={{
              transitionDelay: `${delay + i * 40}ms`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </Tag>
  );
}
