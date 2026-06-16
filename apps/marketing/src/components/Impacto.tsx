'use client';

import { useRef, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

// Un hook rápido de React para el IntersectionObserver (Odómetro numérico)
function useCountUp(endValue: number, prefix = '', suffix = '') {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated) {
        setHasAnimated(true);
        const duration = 2500;
        const frames = 60;
        const step = endValue / (duration / (1000 / frames));
        let current = 0;

        const animate = () => {
          current += step;
          if (current < endValue) {
            setCount(Math.ceil(current));
            requestAnimationFrame(animate);
          } else {
            setCount(endValue);
          }
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.5 });

    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, [endValue, hasAnimated]);

  return { ref, content: `${prefix}${count.toLocaleString()}${suffix}` };
}

export default function Impacto() {
  const { langDict } = useLanguage();
  const i = langDict.impact;

  const metric1 = useCountUp(18, '+', '');
  const metric2 = useCountUp(40, '+', '');
  const metric3 = useCountUp(256, '', ' Bits');
  const metric4 = useCountUp(99, '', '.9%');

  const stats = [
    { label: i.m1, ...metric1 },
    { label: i.m2, ...metric2 },
    { label: i.m3, ...metric3 },
    { label: i.m4, ...metric4 },
  ];

  return (
    <section className="py-20 bg-slate-950 border-y border-slate-800">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-800/50">
          {stats.map((stat, i) => (
            <div key={i} className={`flex flex-col items-center justify-center text-center ${i === 0 ? '' : 'pl-8'}`}>
              <div ref={stat.ref} className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tighter drop-shadow-md">
                {stat.content}
              </div>
              <div className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
