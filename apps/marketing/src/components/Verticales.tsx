'use client';

import { useState } from 'react';
import { Landmark, Truck, HeartPulse, ArrowRight, ShieldCheck, Database, Network } from 'lucide-react';

export default function Verticales() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      id: 'fintech',
      title: 'Finanzas & Banca',
      icon: <Landmark className="w-5 h-5" />,
      tag: 'FINTECH',
      content: {
        title: 'Ciberseguridad transaccional de alta frecuencia.',
        desc: 'Protegemos la integridad de Core Bancarios y plataformas FinTech. Implementamos bóvedas criptográficas descentralizadas y pipelines de validación Zero-Trust capaces de auditar miles de transacciones por milisegundo sin latencia perceptible.',
        features: ['Tokenización AES-256', 'Arquitectura PCI Compliant', 'Anti-Lavado IA (AML)'],
        stat: '0.001ms',
        statLabel: 'Latencia Criptográfica'
      }
    },
    {
      id: 'logistica',
      title: 'Logística & Supply',
      icon: <Truck className="w-5 h-5" />,
      tag: 'LOGISTICS',
      content: {
        title: 'Optimización de flotas y telemetría global.',
        desc: 'Transformamos flotas estáticas en mallas de datos dinámicos. Ingestamos millones de pings geolocalizados mediante arquitectura Event-Driven, calculando rutas óptimas y previniendo quiebres de stock mediante simulaciones predictivas Edge.',
        features: ['Telemetría IoT en Vivo', 'Machine Learning de Rutas', 'Digital Twins Portuarios'],
        stat: '10M+',
        statLabel: 'Eventos procesados/hr'
      }
    },
    {
      id: 'healthtech',
      title: 'Salud Digital',
      icon: <HeartPulse className="w-5 h-5" />,
      tag: 'HEALTHTECH',
      content: {
        title: 'Interoperabilidad clínica y reserva de horas IA.',
        desc: 'Unificamos ecosistemas hospitalarios fragmentados. Desde historias clínicas electrónicas inmutables hasta bots inteligentes de triaje. Nuestra infraestructura garantiza 99.99% de disponibilidad en ambientes donde un microsegundo salva vidas.',
        features: ['HIPAA / HL7 Compliant', 'Ecosistema Telemedicina', 'Predicción de Camas (IA)'],
        stat: '99.99%',
        statLabel: 'Availability (SLA)'
      }
    }
  ];

  return (
    <section className="py-24 bg-[#0a0a0e] relative border-y border-slate-900">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center md:text-left mb-16 max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Soluciones por <span className="text-amber-500">Industria</span>.
          </h2>
          <p className="text-slate-400 text-base max-w-2xl text-justify">
            Sabemos que el software logístico no funciona en un core bancario. Desarrollamos infraestructuras de propósito específico moldeadas a la presión crítica de tu ecosistema.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          
          {/* Navegación por Tab (Vertical Sidebar) */}
          <div className="lg:w-1/3 flex flex-col space-y-4 relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-800 hidden lg:block" />
            
            {tabs.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(idx)}
                className={`relative flex items-center justify-between p-6 rounded-2xl w-full text-left transition-all duration-300 ${
                  activeTab === idx 
                  ? 'bg-slate-900 border border-slate-700 shadow-xl lg:translate-x-4' 
                  : 'hover:bg-slate-900/50 border border-transparent'
                }`}
              >
                {/* Indicador activo desktop */}
                {activeTab === idx && (
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-px bg-amber-500 hidden lg:block" />
                )}
                
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${activeTab === idx ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-900 text-slate-500'}`}>
                    {tab.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold ${activeTab === idx ? 'text-white' : 'text-slate-400'}`}>
                      {tab.title}
                    </h3>
                  </div>
                </div>
                <ArrowRight className={`w-5 h-5 transition-transform ${activeTab === idx ? 'text-amber-500 translate-x-2' : 'text-slate-700'}`} />
              </button>
            ))}
          </div>

          {/* Dinámico Display de Tab */}
          <div className="lg:w-2/3">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 h-full flex flex-col relative overflow-hidden group">
              {/* Wireframe background */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px]" />
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none transition-all duration-700" />
              
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold tracking-widest mb-6 uppercase">
                <Network className="w-4 h-4" />
                {tabs[activeTab].tag}
              </div>

              <h3 className="text-3xl lg:text-4xl font-extrabold text-white mb-6 relative z-10 transition-all -ml-[2px]">
                {tabs[activeTab].content.title}
              </h3>
              
              <p className="text-sm text-slate-400 mb-8 leading-relaxed relative z-10 text-justify">
                {tabs[activeTab].content.desc}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-auto relative z-10 items-center">
                <ul className="space-y-4">
                  {tabs[activeTab].content.features.map((feat, i) => (
                    <li key={i} className="flex items-center text-slate-300 font-medium text-sm">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 mr-3" />
                      {feat}
                    </li>
                  ))}
                </ul>
                
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                  <p className="text-4xl font-black text-white">{tabs[activeTab].content.stat}</p>
                  <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mt-2">
                    {tabs[activeTab].content.statLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
