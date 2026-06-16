'use client';

export default function Tecnologias() {
  const logos = [
    { name: 'Amazon Web Services', color: 'text-[#FF9900]' },
    { name: 'Google Cloud Platform', color: 'text-[#4285F4]' },
    { name: 'Microsoft Azure', color: 'text-[#0089D6]' },
    { name: 'Vercel Edge', color: 'text-white' },
    { name: 'Next.js Arch', color: 'text-slate-300' },
    { name: 'React 19', color: 'text-[#61DAFB]' },
    { name: 'PostgreSQL', color: 'text-[#336791]' },
    { name: 'Python Analytics', color: 'text-[#3776AB]' },
    { name: 'Docker Scale', color: 'text-[#2496ED]' }
  ];

  // Triplicamos el array para un scroll infinito suave sin cortes
  const marqueeItems = [...logos, ...logos, ...logos];

  return (
    <section className="py-12 bg-slate-950 border-y border-slate-900 border-opacity-50 overflow-hidden relative">
      {/* Sombras difuminadas en los bordes para el efecto fade */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
      
      <div className="flex w-fit animate-marquee hover:pause-animation">
        {marqueeItems.map((logo, index) => (
          <div 
            key={index} 
            className="flex items-center justify-center px-10 py-4 mx-4 rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm whitespace-nowrap group hover:border-slate-700 transition-colors"
          >
            <span className={`text-xl font-bold tracking-wider ${logo.color} opacity-70 group-hover:opacity-100 transition-opacity`}>
              {logo.name}
            </span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
