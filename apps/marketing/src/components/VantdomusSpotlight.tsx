'use client';

import { Building2, Layers, HardHat, FileCheck, ArrowRight, KanbanSquare, Truck, Stethoscope, Landmark } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function VantdomusSpotlight() {
  const [activeUnit, setActiveUnit] = useState(0);
  const [activeIndustry, setActiveIndustry] = useState(0);

  // Base de datos de simulación por industria
  const industries = [
    {
      id: 'edificios',
      name: 'EDIFICIOS',
      icon: <Building2 className="w-4 h-4" />,
      project: 'Torre Costanera',
      units: [
        { id: '101A', status: 'entregada', meta: '4.5k UF', owner: 'Corp' },
        { id: '102A', status: 'promesa', meta: '4.2k UF', owner: 'Retail' },
        { id: '103B', status: 'disponible', meta: '5.1k UF', owner: '--' },
        { id: '104B', status: 'observaciones', meta: '4.9k UF', owner: 'Corp' },
      ]
    },
    {
      id: 'mineria',
      name: 'MINERÍA',
      icon: <HardHat className="w-4 h-4" />,
      project: 'Faena Rajo Extremo',
      units: [
        { id: 'PERF-01', status: 'operativa', meta: '100% OEE', owner: 'Frente A' },
        { id: 'VOLQ-04', status: 'mantenimiento', meta: 'Taller', owner: 'Turno 2' },
        { id: 'VOLQ-12', status: 'operativa', meta: '92% OEE', owner: 'Frente B' },
        { id: 'PALA-02', status: 'observaciones', meta: 'Alerta', owner: 'Turno 1' },
      ]
    },
    {
      id: 'supply',
      name: 'SUPPLY CHAIN',
      icon: <Truck className="w-4 h-4" />,
      project: 'Hub Logístico Sur',
      units: [
        { id: 'TRK-92', status: 'en ruta', meta: 'ETA 12:00', owner: 'Flota 1' },
        { id: 'TRK-14', status: 'cargando', meta: 'Andén 4', owner: 'Flota 2' },
        { id: 'TRK-55', status: 'disponible', meta: 'Patio', owner: '--' },
        { id: 'TRK-19', status: 'mantenimiento', meta: 'Taller', owner: '--' },
      ]
    },
    {
      id: 'clinicas',
      name: 'CLÍNICAS',
      icon: <Stethoscope className="w-4 h-4" />,
      project: 'Hospital Central',
      units: [
        { id: 'CAMA-201', status: 'ocupada', meta: 'Paciente', owner: 'UCI' },
        { id: 'CAMA-202', status: 'disponible', meta: 'Aseo OK', owner: 'UTI' },
        { id: 'QUIRO-01', status: 'ocupada', meta: 'Cirugía', owner: 'Pabellón' },
        { id: 'RESO-01', status: 'mantenimiento', meta: 'Técnico', owner: 'Imagenología' },
      ]
    },
    {
      id: 'gobierno',
      name: 'GOBIERNO',
      icon: <Landmark className="w-4 h-4" />,
      project: 'Ministerio OP',
      units: [
        { id: 'EXP-109', status: 'aprobado', meta: 'Firma OK', owner: 'Legal' },
        { id: 'EXP-110', status: 'revision', meta: 'Contraloría', owner: 'Finanzas' },
        { id: 'LICI-44', status: 'publicada', meta: 'Mercado', owner: 'Compras' },
        { id: 'OBRA-12', status: 'observaciones', meta: 'Retraso', owner: 'Inspectores' },
      ]
    }
  ];

  const currentData = industries[activeIndustry];

  // Auto-ciclar la selección de unidades para demostración
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUnit((prev) => (prev + 1) % currentData.units.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [currentData.units.length]);

  return (
    <section className="py-24 bg-[#0a0a0e] relative overflow-hidden border-b border-slate-900">
      
      {/* Background Blueprint Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Cabecera Principal */}
        <div className="mb-20 text-center max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase mb-8 shadow-[0_0_15px_-5px_rgba(245,158,11,0.4)]">
            <Building2 className="w-4 h-4" />
            FLAGSHIP PRODUCT
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 uppercase">
            VANTDOMUS<span className="text-amber-500">.</span>
          </h2>
          <h3 className="text-xl md:text-3xl font-medium text-slate-300 mb-6">
            La Oficina Técnica Digital B2B.
          </h3>
          
          <p className="text-slate-400 text-base md:text-lg text-justify leading-relaxed">
            Elimina la fricción operativa en entornos complejos. Vantdomus es un sistema integral que digitaliza la gestión técnica, trazabilidad de activos y planificación de unidades maestras en tiempo real para Minería, Supply Chain, Clínicas, Facility Management y Servicios Públicos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Lado Copy/Features */}
          <div className="space-y-8 order-2 lg:order-1">
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex gap-6 items-start hover:border-amber-500/30 transition-colors group">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-500 group-hover:bg-amber-500/10 transition-colors">
                <KanbanSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-xl mb-2 -ml-[1px]">Planificador de Unidades</h4>
                <p className="text-sm text-slate-400 text-justify">Visión de inventario en vivo. Controla el ciclo de vida desde &quot;En Obra&quot; hasta &quot;Promesa&quot; y &quot;Entregado&quot; sin usar planillas offline.</p>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex gap-6 items-start hover:border-amber-500/30 transition-colors group">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-500 group-hover:bg-amber-500/10 transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-xl mb-2 -ml-[1px]">Trazabilidad Documental</h4>
                <p className="text-sm text-slate-400 text-justify">Bóvedas digitales inmutables. Planos técnicos, actas de recepción y documentos legales vinculados algorítmicamente a cada unidad, activo o instalación.</p>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex gap-6 items-start hover:border-amber-500/30 transition-colors group">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-500 group-hover:bg-amber-500/10 transition-colors">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-xl mb-2 -ml-[1px]">Conexión Terreno-Resolver</h4>
                <p className="text-sm text-slate-400 text-justify">Captura de observaciones y defectos técnicos en terreno (minas, hospitales, bodegas) de forma nativa, disparando flujos de trabajo de mantenimiento y resolución autónomamente.</p>
              </div>
            </div>

            <div className="pt-4">
              <a href="#contacto" className="inline-flex items-center gap-2 bg-slate-100 hover:bg-white text-slate-950 font-bold px-8 py-4 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95">
                Solicitar una demostración
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Lado Gráfico (Interfaz Simulada de Vantdomus) */}
          <div className="order-1 lg:order-2 notranslate relative" translate="no">
            
            {/* Industry Selector Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {industries.map((industry, index) => (
                <button
                  key={industry.id}
                  onClick={() => { setActiveIndustry(index); setActiveUnit(0); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all ${activeIndustry === index ? 'bg-amber-500 text-slate-950 font-bold shadow-[0_0_15px_-5px_rgba(245,158,11,0.6)]' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'} text-[10px] sm:text-xs tracking-wider`}
                >
                  {industry.icon}
                  {industry.name}
                </button>
              ))}
            </div>

            <div className="bg-[#0f1115] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative">
              
              {/* Header UI */}
              <div className="h-14 border-b border-slate-800 flex items-center px-6 justify-between bg-slate-950">
                <div className="flex items-center gap-4">
                  <div className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    VANTDOMUS
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-slate-700 rounded-full" />
                  <span className="w-2 h-2 bg-slate-700 rounded-full" />
                </div>
              </div>

              {/* Contenido UI (Dashboard Simulado) */}
              <div className="p-6 md:p-8">
                
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/50">
                  <div>
                    <h5 className="text-slate-100 font-medium mb-1">Proyecto: {currentData.project}</h5>
                    <p className="text-xs font-mono text-slate-500">Última sinc: Ahora mismo</p>
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded text-xs font-bold font-mono">
                    ONLINE
                  </div>
                </div>

                {/* Grilla de Unidades */}
                <div className="space-y-3 relative">
                  {currentData.units.map((unit, idx) => {
                    const isActive = activeUnit === idx;
                    
                    return (
                      <div 
                        key={unit.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500
                          ${isActive ? 'bg-amber-500/5 border-amber-500/50 shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)]' : 'bg-slate-900 border-slate-800'}`}
                      >
                        <div className="flex items-center gap-4">
                          <FileCheck className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-slate-600'}`} />
                          <div>
                            <div className={`font-mono font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                              UD {unit.id}
                            </div>
                            <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                              {unit.owner}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                           <div className="hidden sm:block text-slate-400 font-mono text-sm">
                             {unit.meta}
                           </div>
                           <div className={`text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full
                             ${unit.status === 'entregada' || unit.status === 'operativa' || unit.status === 'aprobado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                               unit.status === 'disponible' || unit.status === 'publicada' ? 'bg-slate-800 text-slate-300' : 
                               unit.status === 'observaciones' || unit.status === 'mantenimiento' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                               'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}
                           >
                             {unit.status}
                           </div>
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Highlight animado (simulando selección en tiempo real del API) */}
                  <div 
                    className="absolute inset-x-0 h-[74px] border-l-2 border-amber-500 transition-all duration-500 pointer-events-none z-10"
                    style={{ top: `${activeUnit * 86}px` }}
                  />
                </div>

              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
