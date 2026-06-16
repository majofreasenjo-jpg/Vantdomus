'use client';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppWidget() {
  const phoneNumber = '56900000000'; // DUMMY NUMBER, USER MUST REPLACE
  const defaultMessage = '¡Hola Luxen! Me gustaría recibir una asesoría corporativa sobre sus servicios y arquitectura.';
  const link = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMessage)}`;

  return (
    <a 
      href={link} 
      target="_blank" 
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[9900] flex items-center justify-center w-14 h-14 bg-green-600 text-white rounded-full shadow-[0_0_20px_-3px_rgba(22,163,74,0.6)] hover:scale-110 transition-transform duration-300 group"
    >
      <span className="absolute inset-0 rounded-full bg-green-500 opacity-40 animate-ping" />
      <MessageCircle className="w-7 h-7 z-10 drop-shadow-md" />
      
      {/* Tooltip Hover Exclusivo de PC */}
      <div className="absolute right-full mr-4 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none drop-shadow-xl hidden md:block">
        Chat Corporativo Directo
      </div>
    </a>
  );
}
