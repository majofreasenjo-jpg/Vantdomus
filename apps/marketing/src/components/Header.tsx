'use client';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

export default function Header() {
  const { language, setLanguage } = useLanguage();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 border-b border-transparent ${scrolled ? 'bg-slate-950/80 backdrop-blur-md border-slate-800 shadow-sm' : 'bg-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <Link href="/" className="text-xl font-bold text-white tracking-widest uppercase flex items-center hover:scale-105 transition-transform">
          Luxen<span className="text-amber-500 text-2xl ml-0.5">.</span>
        </Link>

        {/* Controles Derechos */}
        <div className="flex items-center space-x-4">
          
          {/* Cmd+K B2B Search Trigger */}
          <button 
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="hidden md:flex items-center space-x-2 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-1.5 transition-colors text-slate-400 group shadow-sm"
          >
            <Search className="w-4 h-4 group-hover:text-amber-400 transition-colors" />
            <span className="text-sm font-medium pr-2">Navegar...</span>
            <kbd className="hidden lg:inline-flex items-center bg-slate-950 border border-slate-700 px-1.5 rounded text-[10px] font-mono font-medium text-slate-500">
              Cmd K
            </kbd>
          </button>

          <Link href="/changelog" className="hidden md:flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mr-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </div>
            Changelog
          </Link>

          {/* Download Executive Brief CTA */}
          <Link href="/executive-brief" target="_blank" className="hidden md:flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all shadow-[0_0_15px_-5px_rgba(79,70,229,0.3)] mr-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            EXECUTIVE BRIEF
          </Link>

          {/* Language Switcher */}
          <div className="flex items-center space-x-1 border border-slate-800 rounded-full p-1 bg-slate-900/50 backdrop-blur shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)]">
            <button 
              onClick={() => setLanguage('es')}
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider transition-all duration-300 ${language === 'es' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              ES
            </button>
            <button 
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider transition-all duration-300 ${language === 'en' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
