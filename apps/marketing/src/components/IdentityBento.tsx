'use client';

import { ScanFace, Fingerprint, ShieldAlert, Cpu, CheckCircle2, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function IdentityBento() {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'blocked' | 'verified'>('idle');

  // Secuencia de simulación
  useEffect(() => {
    const cycle = () => {
      setScanState('scanning');
      setTimeout(() => {
        // 50% de probabilidad de bloqueo o exito para hacer la demo dinámica
        setScanState(Math.random() > 0.5 ? 'blocked' : 'verified');
        setTimeout(() => setScanState('idle'), 3000);
      }, 2000);
    };

    const interval = setInterval(cycle, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 bg-[#050508] relative overflow-hidden border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center">
        
        <div className="text-center mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase mb-8 shadow-[0_0_15px_-5px_rgba(16,185,129,0.4)]">
            <LockKeyhole className="w-4 h-4" />
            IDENTITY ARMOR
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-6">
            El MFA tradicional ha muerto.
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Bloqueamos inyecciones de cámaras virtuales, Deepfakes y robo de tokens (AiTM) en tiempo real mediante Liveness Detection y Telemetría Criptográfica.
          </p>
        </div>

        {/* Bento Board Simulator */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Liveness Scanner Panel */}
          <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <h3 className="text-white font-bold text-xl mb-1">Motor Biométrico 3D</h3>
                <p className="text-sm text-slate-400 font-mono">LIVENESS_DETECTION_v4</p>
              </div>
              <ScanFace className={`w-8 h-8 ${scanState === 'scanning' ? 'text-amber-400 animate-pulse' : scanState === 'blocked' ? 'text-red-500' : scanState === 'verified' ? 'text-emerald-500' : 'text-slate-600'}`} />
            </div>

            <div className="relative flex-grow flex items-center justify-center p-4">
              {/* Radar UI */}
              <div className="relative w-40 h-40 border-2 border-slate-800 rounded-full flex items-center justify-center">
                {scanState === 'scanning' && (
                  <div className="absolute inset-0 rounded-full border-r-2 border-amber-500 animate-spin" />
                )}
                {scanState === 'blocked' && (
                  <div className="absolute inset-0 rounded-full bg-red-500/20 border border-red-500 animate-pulse" />
                )}
                {scanState === 'verified' && (
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-500" />
                )}
                
                {/* Center Icon */}
                {scanState === 'idle' && <Fingerprint className="w-12 h-12 text-slate-700" />}
                {scanState === 'scanning' && <Cpu className="w-12 h-12 text-amber-500" />}
                {scanState === 'blocked' && <ShieldAlert className="w-12 h-12 text-red-500" />}
                {scanState === 'verified' && <CheckCircle2 className="w-12 h-12 text-emerald-500" />}
              </div>
            </div>

            {/* Status Console */}
            <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex justify-between items-center z-10">
              <span className="text-slate-500">Estado de Validación:</span>
              {scanState === 'idle' && <span className="text-slate-400">ESPERANDO PAYLOAD...</span>}
              {scanState === 'scanning' && <span className="text-amber-400">ANALIZANDO METADATA...</span>}
              {scanState === 'blocked' && <span className="text-red-400 font-bold">¡VIRTUAL CAM DETECTADA!</span>}
              {scanState === 'verified' && <span className="text-emerald-400 font-bold">IDENTIDAD CERTIFICADA</span>}
            </div>
          </div>

          {/* AiTM Block Panel */}
          <div className="md:col-span-1 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="text-white font-bold text-lg mb-2 -ml-[2px]">Anti-AiTM</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-6 text-justify tracking-tight">
                Anclamos criptográficamente las sesiones al dispositivo de hardware (FIDO2), dejando inútiles los proxies de robo de tokens.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-slate-900/80 border border-emerald-900/30 rounded-lg flex justify-between items-center">
                <span className="text-[10px] text-slate-500 uppercase">Hardware Key</span>
                <span className="text-xs font-mono text-emerald-400">SECURE</span>
              </div>
              <div className="p-3 bg-slate-900/80 border border-emerald-900/30 rounded-lg flex justify-between items-center">
                <span className="text-[10px] text-slate-500 uppercase">Session Bind</span>
                <span className="text-xs font-mono text-emerald-400">VERIFIED</span>
              </div>
              <div className={`p-3 rounded-lg flex justify-between items-center transition-colors ${scanState === 'blocked' ? 'bg-red-950/30 border border-red-900/50' : 'bg-slate-900/80 border border-slate-800'}`}>
                <span className="text-[10px] text-slate-500 uppercase">Token Origin</span>
                <span className={`text-xs font-mono ${scanState === 'blocked' ? 'text-red-400' : 'text-slate-400'}`}>
                  {scanState === 'blocked' ? 'PROXY_DETECTED' : 'AUTH_OK'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
