import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Activity, ServerCrash, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export const metadata = {
  title: 'System Status | Luxen',
  description: 'Monitoreo en tiempo real de la infraestructura Edge de Luxen.',
};

export default function StatusPage() {
  const regions = [
    { name: 'US-East (N. Virginia)', status: 'operational', latency: '12ms' },
    { name: 'US-West (Oregon)', status: 'operational', latency: '24ms' },
    { name: 'SA-East (São Paulo)', status: 'operational', latency: '45ms' },
    { name: 'EU-Central (Frankfurt)', status: 'operational', latency: '85ms' },
    { name: 'AP-Northeast (Tokyo)', status: 'operational', latency: '110ms' }
  ];

  const services = [
    { name: 'API Routing (Edge)', status: 'operational', uptime: '99.99%' },
    { name: 'PostgreSQL Datacenter', status: 'operational', uptime: '99.99%' },
    { name: 'ML/AI Analytics Engine', status: 'operational', uptime: '99.95%' },
    { name: 'Turnstile Auth Auth', status: 'operational', uptime: '100%' }
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen pt-32 pb-24 bg-[#0d1117]">
        <div className="max-w-4xl mx-auto px-6">
          
          {/* Cabecera Status */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">System Status</h1>
              <p className="text-slate-400">Monitoreo global de la infraestructura Luxen Edge.</p>
            </div>
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-xl">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <span className="text-emerald-400 font-bold tracking-wide">All Systems Operational</span>
            </div>
          </div>

          {/* Gráfico de Uptime 90 Días Simulado */}
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 md:p-10 mb-12 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-200">90-Day Uptime History</h3>
              <span className="text-emerald-400 font-mono font-bold">99.992%</span>
            </div>
            
            {/* Barras de 90 días (Visual Flex) */}
            <div className="flex items-end gap-[2px] md:gap-1 h-32 w-full mt-8">
              {Array.from({ length: 90 }).map((_, i) => {
                // Simulamos un día con bajón aleatorio histórico
                const isDegraded = i === 42 || i === 73; 
                return (
                  <div 
                    key={i} 
                    className={`flex-1 rounded-t-sm transition-all hover:opacity-80 cursor-pointer group relative ${isDegraded ? 'bg-amber-500 h-28' : 'bg-emerald-500 h-full'}`}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Hace {90 - i} días<br/>
                      {isDegraded ? 'Mantenimiento Programado' : 'Sin interrupciones'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-4 font-mono">
              <span>Hace 90 días</span>
              <span>Hoy</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Servicios Locales */}
            <div>
              <h3 className="text-lg font-bold text-slate-300 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-500" /> Core Services
              </h3>
              <div className="bg-[#161b22] border border-slate-800 rounded-2xl p-4 md:p-6 space-y-4">
                {services.map((svc, i) => (
                  <div key={i} className="flex justify-between items-center pb-4 border-b border-slate-800/50 last:border-0 last:pb-0">
                    <span className="text-slate-300 font-medium text-sm">{svc.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono hidden sm:inline-block">Uptime: {svc.uptime}</span>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nodos de Red Edge */}
            <div>
              <h3 className="text-lg font-bold text-slate-300 mb-6 flex items-center gap-2">
                <ServerCrash className="w-5 h-5 text-slate-500" /> Global Edge Network
              </h3>
              <div className="bg-[#161b22] border border-slate-800 rounded-2xl p-4 md:p-6 space-y-4">
                {regions.map((reg, i) => (
                  <div key={i} className="flex justify-between items-center pb-4 border-b border-slate-800/50 last:border-0 last:pb-0">
                    <span className="text-slate-300 font-medium text-sm">{reg.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-emerald-400 font-mono">{reg.latency}</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Actualizado automáticamente cada minuto.</span>
            <a href="/seguridad" className="text-amber-500 hover:underline">Ver arquitectura Blueprint &rarr;</a>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
