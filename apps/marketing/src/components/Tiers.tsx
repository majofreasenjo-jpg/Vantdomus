'use client';

import { Check, Zap, Shield, Database } from 'lucide-react';

export default function Tiers() {
  const tiers = [
    {
      name: 'Auditoría & PenTesting',
      desc: 'Análisis de vulnerabilidades y arquitectura actual.',
      icon: <Check className="w-5 h-5 text-slate-400" />,
      features: [
        'Análisis de código estático (SAST)',
        'Simulación de ataques DDoS',
        'Modelado de Costos Cloud Actual',
        'Análisis de Brechas de Seguridad (Zero-Day)'
      ],
      cta: 'Agendar Auditoría Inicial',
      popular: false,
      glow: 'from-slate-800 to-slate-900 border-slate-700'
    },
    {
      name: 'Cloud Modernization',
      desc: 'Migración a arquitectura Serverless y optimización Edge.',
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      features: [
        'Desacoplamiento Front/Back',
        'Migración a Base de Datos Serverless',
        'Malla de protección Cloudflare',
        'Despliegues Continuos Automáticos (CI/CD)',
        'Reducción de latencia a <50ms'
      ],
      cta: 'Diseñar Arquitectura',
      popular: true,
      glow: 'from-amber-500/10 to-amber-950/20 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]'
    },
    {
      name: 'Enterprise Core Bancario',
      desc: 'Sistemas de alta frecuencia y cifrado AES-256 E2E.',
      icon: <Shield className="w-5 h-5 text-emerald-400" />,
      features: [
        'Arquitectura Zero-Trust Nivel Militar',
        'Motor de IA Predictivo integrado',
        'Cifrado End-to-End para Banca y Crypto',
        'Nodos de telemetría IoT global',
        'Soporte SRE Dedicado 24/7'
      ],
      cta: 'Hablar con Arquitecto Jefe',
      popular: false,
      glow: 'from-emerald-950/30 to-slate-900 border-emerald-900/50'
    }
  ];

  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold mb-6">
            <Database className="w-4 h-4 text-emerald-500" />
            Modelos de Despliegue
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
            Escalabilidad a <br />tu propia velocidad.
          </h2>
          <p className="text-slate-400 text-lg">
            No imponemos licencias genéricas. Te acompañamos desde el escaneo forense de vulnerabilidades hasta el despliegue de tu propio Core Bancario en el borde.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, idx) => (
            <div 
              key={idx} 
              className={`relative rounded-3xl p-8 bg-gradient-to-b border flex flex-col h-full transition-transform hover:-translate-y-2 duration-300 ${tier.glow}`}
            >
              {tier.popular && (
                <div className="w-fit mb-6 bg-amber-500 text-slate-950 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] py-1.5 px-4 rounded-md shadow-lg shadow-amber-500/20 border border-amber-400">
                  Integración Estándar
                </div>
              )}
              
              <div className="mb-8">
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800">
                    {tier.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                    <p className="text-slate-400 leading-relaxed text-sm pr-4">{tier.desc}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 space-y-4 mb-8">
                {tier.features.map((feat, i) => (
                  <div key={i} className="flex gap-3 text-slate-300 text-sm">
                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
              
              <a 
                href="#contacto" 
                className={`w-full py-4 rounded-xl font-bold transition-all text-center ${
                  tier.popular 
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20' 
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
