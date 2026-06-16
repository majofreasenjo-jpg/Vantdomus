import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Políticas de Privacidad | Luxen',
  description: 'Políticas de Privacidad y Manejo de Datos Corporativos en Luxen.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative pt-24 pb-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="max-w-4xl mx-auto px-6 relative z-10">
        <Link href="/" className="inline-flex items-center text-amber-500 hover:text-amber-400 transition-colors mb-12 font-semibold group">
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Retornar a Portada
        </Link>
        
        <header className="mb-12 border-b border-slate-800 pb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-slate-100">
            Políticas de Privacidad
          </h1>
          <p className="text-slate-400">Última actualización: Abril 2026</p>
        </header>

        <article className="prose prose-invert prose-amber max-w-none text-slate-300 text-justify">
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">1. Recopilación de Información</h2>
            <p className="mb-4">
              Luxen Spa. recopila información corporativa y personal exclusivamente cuando es proporcionada voluntariamente a través de nuestros formularios de contacto, tales como: nombre, nivel de cargo, correo corporativo, y descripción del proyecto B2B.
            </p>
            <p>
              Adicionalmente, recolectamos analíticas anonimizadas y no intrusivas sobre la interacción tecnológica en nuestra plataforma con el único fin de mejorar el rendimiento y la seguridad del "Digital Hub".
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">2. Uso de la Información</h2>
            <p className="mb-4">
              La información suministrada es utilizada estrictamente para estructurar propuestas técnicas de alto rendimiento, contactar al prospecto B2B, y operar los despliegues de ingeniería contratados. Nos regimos por un enfoque Zero-Trust, lo que significa que el mínimo de personal tiene acceso a sus datos.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">3. Seguridad Grado Bancario</h2>
            <p className="mb-4">
              Implementamos protocolos criptográficos y arquitecturas desacopladas para mantener la infraestructura de la información blindada. Bajo ninguna circunstancia, Luxen vende, distribuye, ni cede sus datos a plataformas publicitarias, brókers de información, ni terceros de ninguna naturaleza.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">4. Retención de Datos B2B</h2>
            <p>
              En caso de no concretar una colaboración ingenieril o acuerdo comercial, Luxen asegura el expurgo definitivo y la destrucción digital de la información recolectada de prospectos en un ciclo no superior a 12 trimestres operacionales, salvo la información requerida bajo regulaciones fiscales chilenas.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
