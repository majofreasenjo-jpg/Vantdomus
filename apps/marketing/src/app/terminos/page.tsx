import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Términos de Servicio | Luxen',
  description: 'Términos y Condiciones Generales de Soluciones Tecnológicas Luxen.',
};

export default function TermsPage() {
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
            Términos de Servicio
          </h1>
          <p className="text-slate-400">Última actualización: Abril 2026</p>
        </header>

        <article className="prose prose-invert prose-amber max-w-none text-slate-300 text-justify">
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">1. Aceptación de los Términos</h2>
            <p className="mb-4">
              Al acceder u operar con el ecosistema digital de Luxen (incluyendo `luxen.cl` y plataformas delegadas), usted reconoce haber leído y aceptar cabalmente las presentes regulaciones operativas B2B. Solamente clientes con capacidad jurídica empresarial o corporativa podrán entablar acuerdos de desarrollo.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">2. Prestación de Servicios IT</h2>
            <p className="mb-4">
              Luxen actúa como una firma consultora y desarrolladora de ingeniería de software. Cada solución a la medida, despliegue en la nube, y ecosistema desarrollado queda delimitado por un <strong>Contrato de Nivel Operativo (SLA)</strong> independiente que dictará métricas de disponibilidad y límites tecnológicos para su proyecto específico.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">3. Propiedad Intelectual Corporativa</h2>
            <p className="mb-4">
              Salvo lo establecido en el acuerdo final de entrega de código fuente (Hand-off Release), todos los frameworks, módulos pre-ensamblados (como VantDomus y similares), bibliotecas internas e infraestructuras desplegadas son propiedad intelectual irrenunciable e intransferible de Luxen.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">4. Disponibilidad y Garantías</h2>
            <p>
              Aunque aplicamos estándares y arquitecturas Hyper-Escalables para mantener la máxima operatividad "Nivel Dios", no garantizamos la disponibilidad infalible por factores o desastres ajenos a la nube (Force Majeure). Las garantías correspondientes al mes de 'Hyper-Care' serán válidas únicamente sin alteración del código nativo por desarrolladores o APIs externas impuestas por el cliente post-despliegue.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
