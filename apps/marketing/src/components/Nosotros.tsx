'use client';

import { Shield, Target, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Nosotros() {
  const { langDict } = useLanguage();
  const a = langDict.about;

  return (
    <section id="nosotros" className="py-24 bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Lado Izquierdo: Copywriting */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-sm font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {a.badge}
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              {a.title1} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
                {a.title2}
              </span>
            </h2>
            
            <p className="text-base text-slate-400 mb-8 leading-relaxed text-justify">
              {a.desc1}
            </p>

            <ul className="space-y-5">
              <li className="flex items-start">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mr-4 mt-1">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-lg">{a.f1_title}</h4>
                  <p className="text-slate-400 text-[13px] mt-1 text-justify">{a.f1_desc}</p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mr-4 mt-1">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-lg">{a.f2_title}</h4>
                  <p className="text-slate-400 text-[13px] mt-1 text-justify">{a.f2_desc}</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Lado Derecho: Visual Corporativo Asimétrico (Tech Flex) */}
          <div className="relative">
            {/* Elemento decorativo de fondo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="space-y-4 pt-12">
                {/* Caja 1: Ingeniería */}
                <div className="h-64 rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden relative group hover:border-emerald-500/50 transition-all duration-300 shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-slate-900/50 to-slate-900 opacity-80" />
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                  <div className="absolute bottom-6 left-6 z-20">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4 border border-emerald-500/30">
                      <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="font-bold text-xl text-white mb-1">{a.c1_title}</p>
                    <p className="text-emerald-400 text-sm font-mono">{a.c1_desc}</p>
                  </div>
                </div>
                
                {/* Caja 2: Equipo / Operativo */}
                <div className="h-48 rounded-3xl bg-gradient-to-t from-slate-900 to-amber-950/20 border border-amber-900/30 p-6 flex flex-col justify-end relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
                  <div className="absolute top-6 right-6">
                    <Users className="w-8 h-8 text-amber-500/50 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <p className="text-slate-200 font-semibold leading-tight text-lg max-w-[150px]">{a.c2_desc}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Caja 3: +50 Proyectos */}
                <div className="h-48 rounded-3xl bg-[#0d1117] border border-slate-800 p-6 flex flex-col justify-center relative overflow-hidden group hover:border-slate-600 transition-all duration-300">
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff22_1px,transparent_1px)] [background-size:16px_16px] opacity-20 group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10">
                    <div className="text-5xl font-black text-white mb-2 tracking-tighter drop-shadow-md -ml-[2px]">{a.c3_num}</div>
                    <p className="text-slate-400 text-[13px] font-medium text-justify">{a.c3_desc}</p>
                  </div>
                </div>
                
                {/* Caja 4: Digital Core */}
                <div className="h-64 rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden relative group hover:border-cyan-500/50 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-tl from-cyan-900/30 via-slate-900/80 to-slate-950 z-10" />
                  <div className="w-full h-full opacity-30 group-hover:scale-110 transition-transform duration-700 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900 via-slate-900 to-transparent flex items-center justify-center">
                    {/* Simulación de un nodo central */}
                    <div className="w-24 h-24 rounded-full border border-cyan-500/30 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border border-cyan-500/50 animate-pulse flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)]" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-6 left-6 z-20">
                    <p className="font-bold text-xl text-white mb-1 drop-shadow-lg">{a.c4_title}</p>
                    <p className="text-cyan-400 text-sm drop-shadow-md font-mono">{a.c4_desc}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
