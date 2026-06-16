import { getPostData, getAllPostSlugs } from '@/lib/blog';
import Link from 'next/link';
import { ArrowLeft, Clock, CalendarDays, FolderGit2 } from 'lucide-react';
import { Metadata } from 'next';

export async function generateStaticParams() {
  const paths = getAllPostSlugs();
  return paths;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const postData = await getPostData(params.slug);
  return {
    title: `${postData.title} | Luxen Insights`,
    description: postData.excerpt,
    openGraph: {
      title: postData.title,
      description: postData.excerpt,
      type: 'article',
      url: `https://luxen.cl/insights/${params.slug}`,
    }
  };
}

export default async function InsightPost(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const postData = await getPostData(params.slug);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative pt-24 pb-24">
      {/* Background glow radial superior */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <main className="max-w-3xl mx-auto px-6 relative z-10">
        
        <Link href="/insights" className="inline-flex items-center text-amber-500 hover:text-amber-400 transition-colors mb-12 font-semibold group">
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Volver a Insights
        </Link>
        
        <article>
          <header className="mb-14">
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">
              <span className="flex items-center bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-md border border-amber-500/20">
                <FolderGit2 className="w-3.5 h-3.5 mr-2" />
                {postData.category}
              </span>
              <span className="flex items-center">
                <CalendarDays className="w-4 h-4 mr-2" />
                {postData.date}
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {postData.readingTime}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
              {postData.title}
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-400 leading-relaxed border-l-4 border-amber-500 pl-6">
              {postData.excerpt}
            </p>
          </header>

          {/* El contenido procesado desde Markdown a HTML */}
          <div 
            className="prose prose-invert prose-lg prose-amber max-w-none 
            prose-headings:text-slate-100 prose-headings:font-bold prose-headings:tracking-tight 
            prose-p:text-slate-300 prose-p:leading-loose 
            prose-a:text-amber-500 prose-a:no-underline hover:prose-a:text-amber-400 
            prose-strong:text-white prose-strong:font-semibold
            prose-blockquote:border-amber-500 prose-blockquote:bg-slate-900/50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-200
            prose-li:text-slate-300"
            dangerouslySetInnerHTML={{ __html: postData.contentHtml || "" }} 
          />
        </article>

        {/* Autor o Footer del articulo */}
        <div className="mt-20 pt-10 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-full flex items-center justify-center font-bold text-white text-lg mr-4 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              L
            </div>
            <div>
              <p className="text-white font-bold">Luxen Engineering</p>
              <p className="text-slate-500 text-sm">Equipo de Arquitectura Cloud</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
