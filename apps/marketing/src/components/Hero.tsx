'use client';

import { useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Hero() {
  const container = useRef<HTMLDivElement>(null);
  const { langDict } = useLanguage();

  // Animación de entrada Nivel Dios
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    tl.fromTo('.hero-text', 
      { y: 50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1, stagger: 0.2 }
    )
    .fromTo('.hero-btn',
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5 },
      "-=0.5"
    );
  }, { scope: container });

  return (
    <section ref={container} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      
      {/* Fondo optimizado (Carga diferida automática) */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/hero-bg.png" /* Cambiado a .png por la imagen generada, puedes cambiarlo si generas webp */
          alt="Tecnología abstracta Luxen"
          fill
          priority // Prioridad máxima de carga para el LCP
          className="object-cover opacity-20"
          quality={85}
        />
        {/* Gradiente oscuro para superposición */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 text-center z-10">
        <h1 className="hero-text text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-white">
          {langDict.hero.titleLine1} <span className="text-amber-500">{langDict.hero.titleLine2}</span>
        </h1>
        
        <p className="hero-text mt-4 max-w-3xl mx-auto text-xl text-slate-300 mb-10 text-center text-balance">
          {langDict.hero.p}
        </p>
        
        <div className="hero-btn flex justify-center gap-4">
          <a href="#contacto" className="inline-flex items-center justify-center rounded-md bg-amber-500 px-8 py-4 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-400 transition-colors">
            {langDict.hero.ctaPrimary}
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
          <a href="#servicios" className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-transparent px-8 py-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors">
            {langDict.hero.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}
