import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  end: number;
  duration?: number; // in milliseconds
}

export default function CountUp({ end, duration = 1200 }: CountUpProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCount(end);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          startCount();
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    function startCount() {
      let startTime: number | null = null;

      function updateCount(timestamp: number) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // cubic-bezier(0.22, 1, 0.36, 1) approximation for number count-up: easeOutCubic
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(easeProgress * end);

        setCount(currentValue);

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          setCount(end);
        }
      }

      requestAnimationFrame(updateCount);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [end, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}
