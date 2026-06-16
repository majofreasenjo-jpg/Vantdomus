'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); 
  const { langDict } = useLanguage();
  const f = langDict.faq;

  const faqs = [
    { q: f.q1, a: f.a1 },
    { q: f.q2, a: f.a2 },
    { q: f.q3, a: f.a3 },
    { q: f.q4, a: f.a4 }
  ];

  return (
    <section className="py-24 bg-slate-950 text-slate-50 relative">
      <div className="max-w-4xl mx-auto px-6">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            {f.title}
          </h2>
          <p className="text-slate-400 text-lg">
            {f.desc}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index}
                className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'bg-slate-900 border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
              >
                <button
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className={`font-semibold text-lg transition-colors ${isOpen ? 'text-amber-400' : 'text-slate-200'}`}>
                    {faq.q}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-amber-500' : ''}`} />
                </button>
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 pb-6 opacity-100' : 'max-h-0 pb-0 opacity-0'}`}
                >
                  <p className="text-sm text-slate-400 leading-relaxed -ml-1 text-justify">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
