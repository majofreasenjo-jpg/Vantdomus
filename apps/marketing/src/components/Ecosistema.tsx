'use client';

import { Box, Code, Database, Globe, Shield, Terminal, Zap } from 'lucide-react';

export default function Ecosistema() {
  const nodes = [
    { icon: <Database className="w-6 h-6 text-[#336791]" />, name: 'P-SQL', x: '10%', y: '20%' },
    { icon: <Box className="w-6 h-6 text-[#2496ED]" />, name: 'Docker', x: '80%', y: '15%' },
    { icon: <Code className="w-6 h-6 text-[#3178C6]" />, name: 'TS', x: '25%', y: '70%' },
    { icon: <Globe className="w-6 h-6 text-white" />, name: 'V-Edge', x: '75%', y: '80%' },
    { icon: <Zap className="w-6 h-6 text-[#FF9900]" />, name: 'AWS', x: '50%', y: '10%' },
    { icon: <Shield className="w-6 h-6 text-[#F6821F]" />, name: 'C-Flare', x: '15%', y: '45%' },
    { icon: <Terminal className="w-6 h-6 text-[#6B4FBB]" />, name: 'Stripe', x: '85%', y: '50%' }
  ];

  return (
    <section className="py-24 bg-[#0a0a0e] relative overflow-hidden border-b border-slate-900">
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-16">
        
        {/* Lado Copywriting */}
        <div className="md:w-1/2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold mb-6">
            <Globe className="w-4 h-4 text-cyan-500" />
            Integraciones Core
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">
            Hiperconectados a <br />tu <span className="text-cyan-500">Ecosistema actual</span>.
          </h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed text-justify">
            No imponemos "soluciones de caja". Las plataformas que orquestamos en Luxen nacen interoperables. Nuestro código se engrana nativamente con los sistemas legados de SAP, pasarelas PISP bancarias, nodos de Blockchain y clusters de K8s.
          </p>
          <div className="flex gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 text-center">
              <div className="text-3xl font-black text-white mb-1">140+</div>
              <div className="text-xs text-slate-500 font-bold uppercase">APIs Soportadas</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 text-center">
              <div className="text-3xl font-black text-white mb-1">Zero</div>
              <div className="text-xs text-slate-500 font-bold uppercase">Vendor Lock-in</div>
            </div>
          </div>
        </div>

        {/* Constelación de Nodos Decorativa */}
        <div className="md:w-1/2 h-[400px] w-full relative">
          {/* Nodo Central (Luxen) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-cyan-500/20 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-2 border-cyan-500/40 animate-[spin_10s_linear_infinite] border-dashed" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-slate-900 border border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.5)] rounded-full flex items-center justify-center">
              <img src="/favicon.ico" alt="Luxen" className="w-10 h-10 object-contain invert brightness-0 opacity-80" />
            </div>
          </div>

          {/* Nodos Periféricos conectados (Visuales) */}
          {nodes.map((node, i) => (
            <div 
              key={i} 
              className="absolute w-12 h-12 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center p-2 shadow-xl hover:scale-110 transition-transform cursor-crosshair group"
              style={{ left: node.x, top: node.y }}
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              {node.icon}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-950 px-2 py-1 rounded">
                {node.name}
              </div>
            </div>
          ))}

          {/* Líneas SVG Fijas detrás */}
          <svg className="absolute inset-0 w-full h-full -z-10 pointer-events-none opacity-20">
             <line x1="50%" y1="50%" x2="10%" y2="20%" stroke="cyan" strokeWidth="1" strokeDasharray="5,5" />
             <line x1="50%" y1="50%" x2="80%" y2="15%" stroke="cyan" strokeWidth="1" strokeDasharray="5,5" />
             <line x1="50%" y1="50%" x2="25%" y2="70%" stroke="cyan" strokeWidth="1" strokeDasharray="5,5" />
             <line x1="50%" y1="50%" x2="75%" y2="80%" stroke="cyan" strokeWidth="1" strokeDasharray="5,5" />
             <line x1="50%" y1="50%" x2="50%" y2="10%" stroke="cyan" strokeWidth="1" strokeDasharray="5,5" />
             <line x1="50%" y1="50%" x2="15%" y2="45%" stroke="cyan" strokeWidth="1" strokeDasharray="5,5" />
             <line x1="50%" y1="50%" x2="85%" y2="50%" stroke="cyan" strokeWidth="1" strokeDasharray="5,5" />
          </svg>
        </div>

      </div>
    </section>
  );
}
