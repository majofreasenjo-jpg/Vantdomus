'use client';

import { Code2, Cloud, Cpu, ShieldCheck, ScanFace, Scale } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Servicios() {
  const { langDict } = useLanguage();
  const s = langDict.services;

  const servicios = [
    {
      titulo: s.s1_title,
      descripcion: s.s1_desc,
      icono: <Code2 className="w-10 h-10 text-amber-500" />,
      bentoClass: "md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800"
    },
    {
      titulo: s.s2_title,
      descripcion: s.s2_desc,
      icono: <Cloud className="w-10 h-10 text-emerald-400" />,
      bentoClass: "md:col-span-1 bg-slate-900"
    },
    {
      titulo: s.s3_title,
      descripcion: s.s3_desc,
      icono: <Cpu className="w-10 h-10 text-cyan-400" />,
      bentoClass: "md:col-span-1 bg-slate-900"
    },
    {
      titulo: s.s4_title,
      descripcion: s.s4_desc,
      icono: <ShieldCheck className="w-10 h-10 text-amber-500" />,
      bentoClass: "md:col-span-1 bg-gradient-to-bl from-slate-900 via-slate-900 to-amber-950/20 border-amber-900/30"
    },
    {
      titulo: s.s5_title,
      descripcion: s.s5_desc,
      icono: <ScanFace className="w-10 h-10 text-emerald-400" />,
      bentoClass: "md:col-span-1 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border-emerald-900/30"
    },
    {
      titulo: (s as any).s6_title || "Data Intelligence & Resolución de Claims", // Fallback if TS fails briefly during hot-reload
      descripcion: (s as any).s6_desc || "Auditoría forense de datos y modelado algorítmico matemático.",
      icono: <Scale className="w-10 h-10 text-indigo-400" />,
      bentoClass: "md:col-span-3 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border-indigo-900/30"
    },
  ];

  return (
    <section id="servicios" className="py-24 bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* Luces de fondo asimétricas */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            {s.title1} <span className="text-amber-500">{s.title2}</span>
          </h2>
          <p className="text-slate-400 text-base max-w-3xl mx-auto text-center">
            {s.desc}
          </p>
        </div>

        {/* Bento Box Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
          {servicios.map((servicio, index) => (
            <div 
              key={index} 
              className={`group p-8 rounded-3xl border border-slate-800 hover:border-amber-500/50 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] flex flex-col justify-between ${servicio.bentoClass}`}
            >
              <div>
                <div className="mb-6 p-4 inline-block bg-slate-950/50 backdrop-blur-sm rounded-2xl border border-slate-800/80 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                  {servicio.icono}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-slate-200 group-hover:text-amber-400 transition-colors -ml-[2px]">
                  {servicio.titulo}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed text-justify">
                  {servicio.descripcion}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
