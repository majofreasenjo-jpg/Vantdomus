'use client';

export default function PrintButton() {
  return (
    <a href="/Executive_Brief_Luxen.pdf" download="Executive_Brief_Luxen.pdf" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-md font-bold shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] flex items-center gap-2 transition-all transform hover:scale-105">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      Descargar PDF
    </a>
  );
}
