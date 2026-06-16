'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, ShieldAlert, CheckCircle, TerminalSquare, Network } from 'lucide-react';

export default function ApiSandbox() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{text: string, time: string}[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'secured'>('idle');
  const [tick, setTick] = useState(0);

  const simulationSteps = [
    "Initialising botnet fleet on Tor relays...",
    "TARGET: luxen.cl/api/v1/auth/bitcoin-node [POST]",
    "[WARN] Sending 50,000 parallel connection requests (DDoS attempt)...",
    "Analyzing TLS Handshake...",
    "Luxen Edge Network intercepted request at Edge Node (Frankfurt)...",
    "[DEFENSE] Cloudflare Turnstile actively analyzing browser metadata...",
    "[DEFENSE] Zero-Trust middleware inspecting packet headers...",
    "CRITICAL: Non-human fingerprint detected (Headless Chrome footprint).",
    "ACTION: Routing traffic to tarpit...",
    "ACTION: IP Subnet Blacklisted globally across Luxen Network.",
    "RESULT: Attack mitigated in 14ms. Origin server unaffected."
  ];

  useEffect(() => {
    if (!isRunning) return;

    if (tick < simulationSteps.length) {
      const delay = tick === simulationSteps.length - 1 ? 800 : 250;
      const timer = setTimeout(() => {
        setLogs(prev => {
          // Evitar insertar repetidos en modo estricto
          if (prev.length > tick) return prev;
          return [...prev, { 
            text: simulationSteps[tick], 
            time: new Date().toISOString().split('T')[1].slice(0,11)
          }];
        });
        setTick(t => t + 1);
      }, delay);
      
      return () => clearTimeout(timer);
    } else {
      setIsRunning(false);
      setStatus('secured');
    }
  }, [isRunning, tick, simulationSteps]);

  const runAttackSimulation = () => {
    if (isRunning || status === 'secured') return;
    setLogs([]);
    setTick(0);
    setIsRunning(true);
    setStatus('running');
  };

  return (
    <section className="py-24 bg-[#0a0a0e] relative overflow-hidden border-y border-slate-900">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Lado Texto / Call to Action */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold mb-6">
              <TerminalSquare className="w-4 h-4" />
              API Developer Sandbox
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-white -ml-[2px]">
              No confíes, <br/><span className="text-indigo-400">Verifícalo en vivo.</span>
            </h2>
            
            <p className="text-sm text-slate-400 mb-8 leading-relaxed text-justify">
              Otras consultoras te prometen que tu software será seguro. Nosotros te invitamos a que intentes tumbar nuestra red. Ejecuta una simulación de ataque distribuido (DDoS / Bot Farm) directamente desde tu navegador y audita cómo nuestro Middleware Edge aniquila la amenaza en tiempo real.
            </p>

            <button
              onClick={runAttackSimulation}
              disabled={isRunning || status === 'secured'}
              className="group flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all duration-300 shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] disabled:shadow-none"
            >
              {isRunning ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                  Simulando Ataque...
                </>
              ) : status === 'secured' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Sistema Blindado
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  Ejecutar Ataque Botnet
                </>
              )}
            </button>
            
            {status === 'secured' && (
              <p className="mt-4 text-sm text-emerald-400 font-mono animate-pulse">
                &rarr; Amenaza neutralizada en la capa de borde.
              </p>
            )}
          </div>

          {/* Consola Interactiva */}
          <div className="bg-[#0d1117] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative h-[450px] flex flex-col group">
            {/* Cabecera de Consola */}
            <div className="bg-[#161b22] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <Network className="w-3 h-3" /> luxen-security-audit.exe
              </div>
            </div>

            {/* Pantalla dividida simulando Request y Response */}
            <div className="flex-1 flex flex-col p-4 overflow-y-auto font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 pb-16 flex-col-reverse notranslate" translate="no">
              <div className="flex flex-col">
                {logs.length === 0 && !isRunning && (
                  <div className="flex flex-col items-center justify-center text-slate-600 opacity-50 group-hover:opacity-100 transition-opacity mt-8">
                    <ShieldAlert className="w-12 h-12 mb-4 drop-shadow-lg" />
                    <p>Esperando payload de ataque...</p>
                  </div>
                )}

                {logs.map((log, idx) => {
                  const text = log.text;
                  const isError = text.includes('CRITICAL') || text.includes('WARN');
                  const isSuccess = text.includes('RESULT') || text.includes('DEFENSE');
                  const isAction = text.includes('ACTION');
                  
                  return (
                    <div 
                      key={idx} 
                      className={`mb-2 break-words ${isError ? 'text-amber-400' : isSuccess ? 'text-emerald-400' : isAction ? 'text-indigo-400' : 'text-slate-300'}`}
                    >
                      <span className="text-slate-600 mr-3">[{log.time}]</span>
                      {text}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overlay Grid Lineal sutil */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[rgba(13,17,23,1)] to-transparent pointer-events-none" />
          </div>

        </div>
      </div>
    </section>
  );
}
