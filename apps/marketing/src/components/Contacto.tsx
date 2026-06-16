'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Turnstile } from '@marsidev/react-turnstile';

export default function Contacto() {
  const { langDict } = useLanguage();
  const c = langDict.contact;
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    empresa: '',
    telefono: '',
    mensaje: '',
  });

  const [estado, setEstado] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado('loading');

    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, turnstileToken: token }),
      });

      if (res.ok) {
        setEstado('success');
        setFormData({ nombre: '', email: '', empresa: '', telefono: '', mensaje: '' });
        // Opcional: Volver al estado normal después de unos segundos
        setTimeout(() => setEstado('idle'), 5000);
      } else {
        setEstado('error');
      }
    } catch (error) {
      console.error('Error:', error);
      setEstado('error');
    }
  };

  return (
    <section id="contacto" className="py-24 bg-slate-950 text-slate-50 relative border-t border-slate-800">
      <div className="max-w-4xl mx-auto px-6 relative z-10">
        
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            {c.title}
          </h2>
          <p className="text-slate-400 text-lg text-center text-balance">
            {c.desc}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            
            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-slate-300 mb-2">{c.nameLabel}</label>
              <input type="text" id="nombre" name="nombre" required value={formData.nombre} onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder={c.namePlaceholder} />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">{c.emailLabel}</label>
              <input type="email" id="email" name="email" required value={formData.email} onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder={c.emailPlaceholder} />
            </div>

            {/* Empresa */}
            <div>
              <label htmlFor="empresa" className="block text-sm font-medium text-slate-300 mb-2">Empresa</label>
              <input type="text" id="empresa" name="empresa" value={formData.empresa} onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="Nombre de tu empresa" />
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-slate-300 mb-2">Teléfono</label>
              <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="+56 9 XXXX XXXX" />
            </div>
          </div>

          {/* Mensaje */}
          <div className="mb-8">
            <label htmlFor="mensaje" className="block text-sm font-medium text-slate-300 mb-2">{c.messageLabel}</label>
            <textarea id="mensaje" name="mensaje" required rows={4} value={formData.mensaje} onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
              placeholder={c.messagePlaceholder} />
          </div>

          {/* Botón y Mensajes de Estado */}
          <div className="flex flex-col items-center">
            
            <div className="mb-6">
              <Turnstile 
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} 
                onSuccess={(t) => setToken(t)}
                options={{ theme: 'dark' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={estado === 'loading' || !token}
              className="w-full md:w-auto px-10 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {estado === 'loading' ? c.buttonSending : c.button}
            </button>

            {estado === 'success' && (
              <p className="mt-4 text-emerald-400 font-medium text-center">
                {c.success}
              </p>
            )}
            
            {estado === 'error' && (
              <p className="mt-4 text-red-400 font-medium text-center">
                {c.error}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
