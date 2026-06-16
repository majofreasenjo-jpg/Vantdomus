'use client';

import { useState } from 'react';
import { Calculator, TrendingDown, ArrowRight } from 'lucide-react';

export default function CalculadoraROI() {
  const [users, setUsers] = useState(500);
  const [currentCost, setCurrentCost] = useState(2000);

  // Estimación B2B conservadora de ahorro en infraestructura Serverless/Edge
  const edgeCost = Math.round(currentCost * 0.35); // 65% de ahorro promedio
  const monthlySavings = currentCost - edgeCost;
  const yearlySavings = monthlySavings * 12;

  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute left-[10%] top-[20%] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Lado interactivo: Controles */}
          <div className="bg-slate-900 border border-slate-800 p-8 md:p-10 rounded-3xl shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Calculator className="w-8 h-8 text-amber-500" />
              <h3 className="text-2xl font-bold text-white">Calculadora ROI</h3>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="flex justify-between text-sm font-medium text-slate-300 mb-4">
                  <span>Usuarios concurrentes promedio</span>
                  <span className="text-emerald-400 font-bold">{users.toLocaleString()}</span>
                </label>
                <input 
                  type="range" 
                  min="50" 
                  max="10000" 
                  step="50"
                  value={users} 
                  onChange={(e) => setUsers(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-colors"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm font-medium text-slate-300 mb-4">
                  <span>Costo mensual actual (AWS/Azure tradicional)</span>
                  <span className="text-emerald-400 font-bold">${currentCost.toLocaleString()} USD</span>
                </label>
                <input 
                  type="range" 
                  min="100" 
                  max="15000" 
                  step="100"
                  value={currentCost} 
                  onChange={(e) => setCurrentCost(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-colors"
                />
              </div>
            </div>

            <div className="mt-10 p-6 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-end mb-2">
                <span className="text-slate-400 font-medium">Ahorro Anual Proyectado</span>
                <span className="text-3xl font-extrabold text-emerald-400 drop-shadow-md">
                  ${yearlySavings.toLocaleString()} USD
                </span>
              </div>
              <p className="text-xs text-slate-500 text-justify mt-2">
                *Estimación basada en migración de servidores monolíticos a arquitectura JAMStack y Edge Functions (Vercel/Cloudflare).
              </p>
            </div>
          </div>

          {/* Lado informativo: Insights Visuales */}
          <div className="flex flex-col justify-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white text-balance">
              Convierte el gasto fijo en <span className="text-emerald-500">rentabilidad edge</span>.
            </h2>
            <p className="text-lg text-slate-400 mb-10 text-justify">
              La arquitectura tradicional obliga a tu empresa a pagar servidores 24/7 incluso si nadie los usa. En Luxen, migramos tu infraestructura operativa hacia la nube Serverless (Edge Computing). <strong>Tu sistema solo consume recursos —y presupuesto— exactamente en el milisegundo en que un usuario hace clic.</strong>
            </p>
            
            <div className="space-y-6">
              {/* Barras Comparativas */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Infraestructura Tradicional</span>
                  <span className="text-slate-300 font-mono">${currentCost}/mo</span>
                </div>
                <div className="w-full h-3 bg-red-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 w-full rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-emerald-400 font-semibold flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" /> Luxen Edge Architecture
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">${edgeCost}/mo</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex transition-all duration-500">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: '35%' }}></div>
                </div>
              </div>
            </div>

            <a href="#contacto" className="mt-12 inline-flex items-center text-amber-400 font-semibold hover:text-amber-300 transition-colors group self-start">
              Audita tu infraestructura con nosotros
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
        
      </div>
    </section>
  );
}
