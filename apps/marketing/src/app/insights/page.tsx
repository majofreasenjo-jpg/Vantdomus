import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getSortedPostsData } from '@/lib/blog';

export const metadata = {
  title: 'Insights | Luxen',
  description: 'Arquitectura Corporativa y Ciberseguridad B2B por el equipo de ingeniería de Luxen.',
};

export default function InsightsPage() {
  const articles = getSortedPostsData();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative pt-24 pb-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="max-w-5xl mx-auto px-6 relative z-10">
        
        <Link href="/" className="inline-flex items-center text-amber-500 hover:text-amber-400 transition-colors mb-12 font-semibold group">
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Retornar a Portada
        </Link>
        
        <header className="mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            Luxen <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Insights</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
            Ingeniería de software, reflexiones corporativas y la infraestructura que acciona a los líderes B2B de hoy.
          </p>
        </header>

        {/* Catálogo de Artículos Dinámico */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link href={`/insights/${article.slug}`} key={article.slug} className="group cursor-pointer relative rounded-2xl bg-slate-900/50 hover:bg-slate-900 shadow-xl shadow-black/20 border border-slate-800 hover:border-amber-500/50 p-6 flex flex-col justify-between min-h-[300px] transition-all duration-300">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                    {article.category}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100 group-hover:text-amber-500 transition-colors leading-snug mb-3">
                  {article.title}
                </h2>
                <p className="text-slate-400 line-clamp-3 text-sm">
                  {article.excerpt}
                </p>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500 font-semibold mt-8 border-t border-slate-800 pt-4 group-hover:border-slate-700 transition-colors">
                <span>{article.date}</span>
                <span className="flex items-center">{article.readingTime} <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" /></span>
              </div>
            </Link>
          ))}
          
          {articles.length === 0 && (
             <div className="col-span-full py-20 text-center text-slate-500">
               <p className="text-lg">No hay insights publicados en este momento.</p>
             </div>
          )}
        </div>

      </main>
    </div>
  );
}
