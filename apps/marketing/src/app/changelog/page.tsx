import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Changelog | Luxen B2B',
  description: 'Historial de despliegues, mejoras en arquitectura y nuevas certificaciones de seguridad.',
};

export default function Changelog() {
  const versions = [
    {
      version: 'v2.4',
      date: '14 Abril 2026',
      title: 'Despliegue de Sandbox Anti-Botnet & Edge Engine',
      type: 'major', // major, minor, patch
      description: 'Liberamos la terminal táctica Sandbox que permite a nuestros partners B2B simular y probar ataques volumétricos en tiempo real contra nuestra capa perimetral. Refactorizamos el SDK nativo para un 40% menor consumo de memoria. Adicionalmente consolidamos nuestra malla de AWS y Cloudflare en la arquitectura Tiers.',
      tags: ['Security', 'Edge Network', 'Feature']
    },
    {
      version: 'v2.3',
      date: '10 Marzo 2026',
      title: 'Monitoreo de Uptime y System Status Nativo',
      type: 'minor',
      description: 'Desplegada la ruta oficial /status para comprobar la latencia criptográfica y disponibilidad de los pods. La API ahora emite un ping LED verde en todo el subsistema público para certificar operaciones al instante.',
      tags: ['Infrastructure', 'SRE']
    },
    {
      version: 'v2.2',
      date: '28 Febrero 2026',
      title: 'Bento-Box Redesign & Tech Flex Console',
      type: 'major',
      description: 'Lanzamiento del lenguaje visual "Silicon Valley Playbook". Sustituimos las grillas obsoletas por asimetría, texturas matriciales y simuladores de tipografía asíncrona. La experiencia de desarrollo inicial ahora fluye a 60FPS sin bloquear el main thread del navegador.',
      tags: ['Design', 'UX']
    },
    {
      version: 'v2.1',
      date: '15 Febrero 2026',
      title: 'Certificación PCI DSS & SOC 2 Type II',
      type: 'minor',
      description: 'Aprobación oficial de las matrices de seguridad para operar con Core Bancarios y nodos Lightning en FinTechs, logrando cumplimiento regulatorio absoluto a nivel auditoría internacional.',
      tags: ['Compliance', 'Security']
    }
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-950 pt-32 pb-24 relative selection:bg-amber-500/30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-cyan-500/10 blur-[150px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          
          {/* Cabecera Changelog */}
          <div className="mb-20">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
              Bitácora de <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Evolución</span>.
            </h1>
            <p className="text-lg text-slate-400 text-balance">
              El software de élite jamás está terminado. Documentamos públicamente cada parche táctico, avance arquitectónico y certificación que desplegamos en el nodo maestro de Luxen.
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-16">
            {versions.map((ver, idx) => (
              <div key={idx} className="relative pl-8 md:pl-0">
                {/* Línea vertical divisoria en móviles */}
                <div className="absolute left-[11px] top-2 bottom-[-4rem] w-px bg-slate-800 md:hidden last:hidden" />
                
                <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8 items-baseline">
                  {/* Fecha y Versión */}
                  <div className="mb-4 md:mb-0 relative">
                    <div className="absolute -left-[37px] top-1.5 w-3 h-3 rounded-full bg-slate-950 border-2 border-amber-500 md:hidden" />
                    <div className="text-sm font-mono text-slate-500 mb-1">{ver.date}</div>
                    <div className="inline-flex items-center gap-2">
                       <span className={`font-bold ${ver.type === 'major' ? 'text-amber-400' : 'text-white'}`}>
                         {ver.version}
                       </span>
                    </div>
                  </div>

                  {/* Tarjeta de Contenido */}
                  <div className="bg-[#0a0a0e] border border-slate-800 rounded-2xl p-6 md:p-8 hover:border-slate-700 transition-colors group">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-4 group-hover:text-amber-400 transition-colors">
                      {ver.title}
                    </h3>
                    <p className="text-slate-400 leading-relaxed mb-6">
                      {ver.description}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {ver.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] uppercase font-bold tracking-widest text-slate-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
