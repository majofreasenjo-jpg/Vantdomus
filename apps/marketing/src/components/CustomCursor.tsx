'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    // Desactivar estrictamente en móviles o tablets touch para evitar bugs nativos.
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
    setIsMobile(false);

    const cursor = cursorRef.current;
    if (!cursor) return;

    // Centrar
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });

    const xTo = gsap.quickTo(cursor, "x", { duration: 0.15, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.15, ease: "power3" });

    const moveCursor = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };

    const handleHover = () => gsap.to(cursor, { scale: 3, backgroundColor: 'transparent', border: '1px solid rgba(245, 158, 11, 1)', duration: 0.2 });
    const handleLeave = () => gsap.to(cursor, { scale: 1, backgroundColor: 'rgba(245, 158, 11, 1)', border: '0px solid transparent', duration: 0.2 });

    window.addEventListener('mousemove', moveCursor);
    
    // Forzar el reinicio visual del cursor cada vez que se hace Scroll
    // Esto evita que quede atascado en el estado "Hover" cuando la página se mueve pero el ratón no
    window.addEventListener('scroll', handleLeave);

    // Asociar a todos los links y botones
    const attachHoverEvents = () => {
      const clickables = document.querySelectorAll('a, button');
      clickables.forEach((el) => {
        el.addEventListener('mouseenter', handleHover);
        el.addEventListener('mouseleave', handleLeave);
      });
    };

    // Timeout para esperar hidratación
    const timer = setTimeout(attachHoverEvents, 1000);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('scroll', handleLeave);
      clearTimeout(timer);
      const clickables = document.querySelectorAll('a, button');
      clickables.forEach((el) => {
        el.removeEventListener('mouseenter', handleHover);
        el.removeEventListener('mouseleave', handleLeave);
      });
    };
  }, []);

  if (isMobile) return null;

  return (
    <div 
      ref={cursorRef}
      className="fixed top-0 left-0 w-3 h-3 rounded-full bg-amber-500 pointer-events-none z-[9999] shadow-[0_0_15px_-2px_rgba(245,158,11,0.8)]"
    />
  );
}
