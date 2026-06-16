import PrintButton from './PrintButton';

export const metadata = {
  title: 'Executive Brief | Luxen B2B',
  description: 'Forensic data auditing and algorithmic mathematical modeling capabilities.',
};

export default function ExecutiveBrief() {
  return (
    <div className="bg-slate-950 text-slate-300 w-full min-h-screen absolute top-0 left-0 z-[100] pb-24">
      
      {/* Botón manual para PDF */}
      <div className="fixed top-8 right-8 z-[110]">
        <PrintButton />
      </div>

      {/* PAGE 1: PORTADA */}
      <div className="min-h-screen flex flex-col justify-center relative overflow-hidden print-break px-6 md:px-24 pt-32">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10">
          <h3 className="text-indigo-500 font-bold tracking-widest text-sm mb-6 uppercase">Luxen B2B Firm</h3>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-8">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-amber-500">INGENIERÍA CLOUD</span><br/>DE ALTA PRESIÓN
          </h1>
          <h2 className="text-3xl font-bold text-white mb-6">NO VENDEMOS CÓDIGO.</h2>
          <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
            Firmas tradicionales le ofrecen "consultoría de transformación". Nosotros desplegamos arquitecturas de software hiper-escalables, analítica forense cero alucinaciones y defensas criptográficas de grado Silicon Valley para asegurar su cuota de mercado B2B.
          </p>
        </div>
      </div>

      {/* PAGE 2 */}
      <div className="min-h-screen flex flex-col justify-center relative px-6 md:px-24 print-break bg-slate-900/50 border-t border-slate-800 py-24">
        <h2 className="text-4xl font-black text-white mb-8 border-b-2 border-indigo-500 pb-4 inline-block self-start">Nuestra Filosofía Fundamental</h2>
        <p className="text-lg text-slate-300 mb-12 leading-relaxed">
          En Luxen entendemos que en entornos de alta presión (Minería, Core Bancario, Infraestructura Pública y Logística), un fallo de software no es un inconveniente; es <span className="text-amber-500 font-bold">sangrado financiero</span>. Nos desmarcamos radicalmente de las agencias tradicionales desarrollando bajo el principio inquebrantable de Matemática Defendible y Cero Alucinación.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
            <h3 className="text-2xl font-bold text-indigo-400 mb-3">Eficiencia Asimétrica</h3>
            <p className="text-slate-400 text-sm">Implementamos herramientas que atacan directamente sus cuellos de botella operativos mediante desarrollo nativo puro, procesando grandes volúmenes a fracciones de milisegundo.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
            <h3 className="text-2xl font-bold text-amber-500 mb-3">Arquitectura Zero-Trust</h3>
            <p className="text-slate-400 text-sm">Asumimos que la red ya está comprometida. Separamos físicamente el motor lógico de la cara pública. Sus datos críticos jamás tocan el internet público de forma directa.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
            <h3 className="text-2xl font-bold text-emerald-400 mb-3">Certeza Matemática</h3>
            <p className="text-slate-400 text-sm">Los LLMs pueden alucinar. Nosotros encapsulamos los motores bajo Reglas Canónicas Estrictas para garantizar que cada dato extraído sea prueba irrefutable ante escenarios técnicos y tribunales.</p>
          </div>
        </div>
      </div>

      {/* PAGE 3 */}
      <div className="min-h-screen flex flex-col justify-center relative px-6 md:px-24 print-break py-24">
        <h2 className="text-4xl font-black text-white mb-12 text-center uppercase tracking-tight">
          Portafolio de <span className="text-indigo-400">Expansión</span>
        </h2>
        
        <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto w-full">
          {/* VANTDOMUS */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl">
            <h3 className="text-3xl font-bold text-white mb-2">VANTDOMUS: Oficial Técnica B2B</h3>
            <p className="text-indigo-400 mb-4 font-semibold uppercase text-xs tracking-wider">Destruyendo la fricción operativa</p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 text-sm">
              <li>Monitoreo y ecosistema maestro para planificación en Obra o Logística.</li>
              <li>Bóvedas inmutables de trazabilidad documental vinculadas a cada activo.</li>
              <li>Sistema de captura y flujos de mitigación de defectos en tiempo real.</li>
            </ul>
          </div>
          
          {/* FORENSIC CLAIMS */}
          <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/30 p-8 rounded-3xl">
            <h3 className="text-3xl font-bold text-white mb-2">Litigation & Claims Analytics</h3>
            <p className="text-amber-500 mb-4 font-semibold uppercase text-xs tracking-wider">Recuperación millonaria a través de telemetría</p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 text-sm">
              <li>Auditoría algorítmica de registros pasivos y reportes manuscritos (cero extrapolación).</li>
              <li>Modelado matemático de improductividades estáticas y lucro cesante.</li>
              <li>Emisión de Claims contractuales irrefutables donde la evidencia anula disputas.</li>
            </ul>
          </div>
          
          {/* IDENTITY ARMOR */}
          <div className="bg-gradient-to-l from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl">
            <h3 className="text-3xl font-bold text-white mb-2">Identity Armor & Anti-Fraude</h3>
            <p className="text-emerald-400 mb-4 font-semibold uppercase text-xs tracking-wider">Defensa activa frente a un entorno hostil</p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 text-sm">
              <li>Auditorías en tiempo real para neutralizar Deepfakes y robo AiTM.</li>
              <li>Bloqueos criptográficos anclados directamente al hardware corporativo (FIDO2).</li>
              <li>Ejecución de redes trampa (Tarpit) en el borde para aniquilar botnets.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* PAGE 4 */}
      <div className="flex flex-col justify-center items-center text-center relative px-6 md:px-24 bg-slate-950 border-t border-slate-800 py-24">
        <div className="max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">EL MOMENTO DE BLINDAR SU OPERACIÓN <span className="text-amber-500">ES HOY.</span></h2>
          
          <p className="text-lg text-slate-400 mb-12">
            Si lo prometemos, intente derribarlo. Somos la única firma B2B que incluye un Sandbox Público Ejecutivo en nuestra web: lo invitamos a lanzar un ataque e intentar doblegar nuestra base. Esa es la infraestructura que instalaremos en su empresa. Un ecosistema tecnológico desprotegido detiene su EBITDA. 
          </p>

          <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl inline-block text-left w-full max-w-lg mb-8 shadow-2xl">
            <h4 className="text-indigo-400 font-bold uppercase tracking-widest text-sm mb-4">Contacto Estratégico</h4>
            <div className="text-white text-base space-y-3">
              <p><strong>🌐 Web:</strong> <a href="https://luxen.cl" className="text-slate-300 hover:text-white transition-colors">www.luxen.cl</a></p>
              <p><strong>✉️ Mail:</strong> <a href="mailto:comercial@luxen.cl" className="text-slate-300 hover:text-white transition-colors">comercial@luxen.cl</a></p>
              <p><strong>📍 HQ:</strong> Santiago & Concón, Chile</p>
            </div>
          </div>
          
          <p className="text-slate-500 font-mono text-xs mt-12 tracking-widest">VANTDOMUS B2B SYSTEM | LUXEN CONFIDENTIAL</p>
        </div>
      </div>

    </div>
  );
}
