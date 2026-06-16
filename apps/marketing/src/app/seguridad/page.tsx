import { Shield, Lock, Server, CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Trust Center | Luxen',
  description: 'Arquitectura de seguridad Zero-Trust y cumplimiento normativo B2B.',
};

export default function SeguridadPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-32 pb-24">
        {/* Header de Seguridad */}
        <div className="max-w-4xl mx-auto px-6 mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 text-sm font-semibold mb-6">
            <Lock className="w-4 h-4" />
            Trust Center
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Seguridad <span className="text-emerald-500">Zero-Trust</span>
          </h1>
          <p className="text-xl text-slate-400 text-balance">
            La protección de tus activos digitales no es una característica, es el núcleo de nuestra arquitectura. Operamos bajo el modelo de que ninguna petición es confiable por defecto.
          </p>
        </div>

        {/* Pilares de Seguridad */}
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
            <Shield className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-2xl font-bold mb-4">Encriptación End-to-End</h3>
            <p className="text-slate-400 text-justify">
              Todos los datos en tránsito y en reposo están cifrados mediante AES-256 y protocolos TLS 1.3. Tu información logística y financiera nunca es visible sin las llaves criptográficas autorizadas.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
            <Server className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-2xl font-bold mb-4">Edge Infrastructure</h3>
            <p className="text-slate-400 text-justify">
              Nuestros sistemas corren al borde de la red global (Edge Computing). Mitigamos ataques DDoS de Tbps distribuyendo la carga de red a nivel mundial antes de que siquiera llegue a tu lógica de negocio.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
            <Lock className="w-10 h-10 text-emerald-400 mb-6" />
            <h3 className="text-2xl font-bold mb-4">Zero-Trust Auth</h3>
            <p className="text-slate-400 text-justify">
              Validamos cada petición mediante tokens efímeros y biometría donde es aplicable. Nadie en la red es confiable, bloqueando movimientos laterales de ciberdelincuentes automáticamente.
            </p>
          </div>
        </div>

        {/* Compliance y Normativas */}
        <div className="max-w-4xl mx-auto px-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-12 rounded-3xl">
          <h2 className="text-3xl font-bold mb-8 text-center">Cumplimiento Operativo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">Protección Anti-Bot Continua</h4>
                <p className="text-sm text-slate-400">Filtrado en milisegundos usando IA de Cloudflare para disuadir ataques automatizados.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">Auditoría Continua</h4>
                <p className="text-sm text-slate-400">Escaneos automatizados de vulnerabilidades (SAST/DAST) en cada línea de código desplegada.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">Resiliencia Operativa</h4>
                <p className="text-sm text-slate-400">Respaldos redundantes multi-zona para garantizar un 99.99% de disponibilidad (SLA).</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">Aislamiento de Recursos</h4>
                <p className="text-sm text-slate-400">Bases de datos aisladas y APIs privadas aseguradas tras firewalls de próxima generación (WAF).</p>
              </div>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </>
  );
}
