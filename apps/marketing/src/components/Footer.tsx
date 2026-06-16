'use client';

import { MapPin, Mail, ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { langDict } = useLanguage();
  const f = langDict.footer;

  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 pt-16 pb-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          {/* Columna 1: Marca y Descripción */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold text-white mb-4">
              Luxen<span className="text-amber-500">.</span>
            </h3>
            <p className="text-slate-400 mb-6 max-w-sm text-left">
              {f.tagline}
            </p>
            <div className="flex gap-2 flex-wrap text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 mb-6">
              <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded flex items-center gap-1"><Shield className="w-3 h-3 text-slate-400" /> ISO/IEC 27001</span>
              <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded flex items-center gap-1"><Shield className="w-3 h-3 text-slate-400" /> SOC 2 Type II</span>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-500 hover:text-amber-500 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
                <span className="sr-only">LinkedIn</span>
              </a>
              <a href="#" className="text-slate-500 hover:text-amber-500 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
                <span className="sr-only">Twitter</span>
              </a>
            </div>
          </div>

          {/* Columna 2: Enlaces Rápidos */}
          <div>
            <h4 className="text-white font-semibold mb-4">{f.platform}</h4>
            <ul className="space-y-3">
              <li><Link href="/#inicio" className="hover:text-amber-400 transition-colors inline-flex items-center group"><ArrowRight className="w-3 h-3 mr-2 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> {f.link1}</Link></li>
              <li><Link href="/#servicios" className="hover:text-amber-400 transition-colors inline-flex items-center group"><ArrowRight className="w-3 h-3 mr-2 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> {f.link2}</Link></li>
              <li><Link href="/insights" className="hover:text-amber-400 transition-colors inline-flex items-center group"><ArrowRight className="w-3 h-3 mr-2 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> {f.link3}</Link></li>
              <li><Link href="/#contacto" className="hover:text-amber-400 transition-colors inline-flex items-center group"><ArrowRight className="w-3 h-3 mr-2 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> {f.link4}</Link></li>
            </ul>
          </div>

          {/* Columna 3: Contacto */}
          <div>
            <h4 className="text-white font-semibold mb-4">{f.contact}</h4>
            <ul className="space-y-4">
              <li className="flex flex-col items-start gap-3">
                <div className="flex items-center">
                  <Mail className="w-5 h-5 text-amber-500 mr-3 shrink-0" />
                  <a href="mailto:comercial@luxen.cl" className="hover:text-white transition-colors">
                    comercial@luxen.cl
                  </a>
                </div>
                <div className="flex items-center">
                  <Mail className="w-5 h-5 text-amber-500 mr-3 shrink-0 opacity-0 md:block hidden" />
                  <a href="mailto:contacto@luxen.cl" className="hover:text-white transition-colors md:pl-0 pl-8">
                    contacto@luxen.cl
                  </a>
                </div>
              </li>
              <li className="flex items-start pt-2">
                <MapPin className="w-5 h-5 text-amber-500 mr-3 shrink-0 mt-0.5" />
                <span>
                  {f.location}
                </span>
              </li>
              <li className="pt-4 mt-4 border-t border-slate-800/50">
                <a href="/status" className="flex items-center text-slate-400 hover:text-emerald-400 transition-colors gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-medium">System Status: All Operational</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Barra Inferior: Copyright y Legales */}
        <div className="pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <p>© {currentYear} Luxen. {f.rights}</p>
          <div className="flex space-x-6">
            <Link href="/executive-brief" className="hover:text-white transition-colors text-indigo-400/80 font-medium">Executive Brief</Link>
            <Link href="/privacidad" className="hover:text-white transition-colors">{f.privacy}</Link>
            <Link href="/terminos" className="hover:text-white transition-colors">{f.terms}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
