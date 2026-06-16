'use client';

import { Activity, Globe2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function EdgeMap() {
  const [activeNodes, setActiveNodes] = useState<number[]>([]);

  // Coordenadas topológicas aproximadas (X, Y)
  const nodes = [
    { id: 1, x: 20, y: 35, name: 'San Francisco, US (AWS-West-1)' },
    { id: 2, x: 30, y: 40, name: 'Virginia, US (AWS-East-1)' },
    { id: 3, x: 25, y: 70, name: 'Santiago, CL (EdgeCore)' },
    { id: 4, x: 35, y: 65, name: 'São Paulo, BR (AWS-SA-East)' },
    { id: 5, x: 50, y: 30, name: 'London, UK (EU-West-2)' },
    { id: 6, x: 55, y: 35, name: 'Frankfurt, DE (EU-Central-1)' },
    { id: 7, x: 80, y: 45, name: 'Singapore, SG (AP-South)' },
    { id: 8, x: 88, y: 35, name: 'Tokyo, JP (AP-Northeast)' }
  ];

  // Rutas activas simuladas
  const routes = [
    { from: 1, to: 2 },
    { from: 2, to: 5 },
    { from: 5, to: 6 },
    { from: 3, to: 4 },
    { from: 4, to: 2 },
    { from: 6, to: 7 },
    { from: 7, to: 8 },
    { from: 1, to: 8 }
  ];

  useEffect(() => {
    // Simular tráfico aleatorio (encender nodos)
    const interval = setInterval(() => {
      const numNodes = Math.floor(Math.random() * 4) + 2; // Encender 2 a 5 nodos a la vez
      const randomIds = [];
      for (let i = 0; i < numNodes; i++) {
        randomIds.push(nodes[Math.floor(Math.random() * nodes.length)].id);
      }
      setActiveNodes(randomIds);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden border-b border-slate-900">
      
      {/* Background glow radial */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row gap-12 lg:items-center">
        
        {/* Lado Gráfico (Mapa Global) */}
        <div className="w-full lg:w-3/5 aspect-[4/3] sm:aspect-video lg:h-[450px] relative">
          
          {/* Rejilla y SVG Mundial Real */}
          <div 
            className="absolute inset-0 bg-cyan-200/20"
            style={{ 
              maskImage: "url('/world.svg')", 
              WebkitMaskImage: "url('/world.svg')", 
              maskSize: "contain", 
              maskPosition: "center", 
              maskRepeat: "no-repeat" 
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff22_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
          
          <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Dibujar Conexiones (Líneas Curvas Bezier) */}
            {routes.map((route, i) => {
              const node1 = nodes.find(n => n.id === route.from)!;
              const node2 = nodes.find(n => n.id === route.to)!;
              const isRouteActive = activeNodes.includes(node1.id) || activeNodes.includes(node2.id);
              
              // Punto de control para curvar ligeramente la línea
              const cx = (node1.x + node2.x) / 2;
              const cy = Math.min(node1.y, node2.y) - 10; 

              return (
                <path 
                  key={i}
                  d={`M ${node1.x} ${node1.y} Q ${cx} ${cy} ${node2.x} ${node2.y}`}
                  fill="none"
                  stroke={isRouteActive ? "rgba(6, 182, 212, 0.4)" : "rgba(30, 41, 59, 1)"}
                  strokeWidth="0.2"
                  className={isRouteActive ? "animate-[pulse_1.5s_ease-in-out_infinite]" : ""}
                />
              );
            })}
          </svg>

          {/* Dibujar Nodos */}
          {nodes.map(node => {
            const isActive = activeNodes.includes(node.id);
            return (
              <div 
                key={node.id}
                className="absolute flex items-center justify-center group"
                style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {/* Latido Radar */}
                {isActive && (
                  <div className="absolute w-8 h-8 rounded-full bg-cyan-500/20 animate-ping" />
                )}
                {/* Punto Core */}
                <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-colors duration-500 ${isActive ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                
                {/* Etiqueta visible, elegante, sin recuadros toscos */}
                <div className="absolute bottom-full mb-1 w-max flex flex-col items-center pointer-events-none z-20">
                  <span className="text-[10px] sm:text-xs text-slate-300 font-bold tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,1)] uppercase">
                    {node.name.split(',')[0]}
                  </span>
                  <span className={`text-[8px] sm:text-[9px] font-mono mt-0.5 ${isActive ? 'text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'text-slate-600'}`}>
                    {isActive ? '< 12ms active' : 'STANDBY'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lado Copywriting centrado dinámicamente */}
        <div className="w-full lg:w-2/5 lg:pl-8">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-widest mb-6 uppercase">
            <Globe2 className="w-4 h-4" />
            GLOBAL EDGE NETWORK
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight -ml-[2px]" style={{ textWrap: 'balance' }}>
            Despliegue multi-región garantizado.
          </h2>
          
          <p className="text-slate-400 text-base mb-8 leading-relaxed text-justify">
            La redundancia no es un lujo, es una arquitectura obligatoria. Distribuimos inteligentemente las cargas de trabajo a través de datacenters geolocalizados, asegurando que tus usuarios se conecten siempre al nodo más cercano.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
              <Server className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="text-white font-bold">14+ POPs Globales</h4>
                <p className="text-sm text-slate-400">Rutas encriptadas de baja latencia.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
              <Activity className="w-6 h-6 text-amber-500" />
              <div>
                <h4 className="text-white font-bold">Resiliencia (Failover)</h4>
                <p className="text-sm text-slate-400">Redirección automática de caídas.</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
