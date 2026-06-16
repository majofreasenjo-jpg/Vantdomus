'use client';

import { useState, useEffect } from 'react';
import { Terminal, Shield, Workflow, Cpu } from 'lucide-react';

export default function TechFlexConsole() {
  const [activeLogic, setActiveLogic] = useState('ciber');
  const [typedText, setTypedText] = useState('');
  
  const snippets: Record<string, string> = {
    ciber: `// Zero-Trust Edge Middleware
export async function middleware(req: NextRequest) {
  // 1. Edge Firewall validation
  const botScore = await cloudflare.turnstile.verify(req);
  if (botScore < 0.8) return DDoS_Mitigation();

  // 2. E2E Decryption payload
  const token = req.headers.get('x-luxen-auth');
  const session = decryptAES256(token, process.env.EDGE_SECRET);
  
  return NextResponse.next();
}`,
    ai: `// Ingesta Distribuida de Telemetría IA
def procesar_flota(stream: KafkaDataStream):
    # Modelos predictivos en memoria compartida (Rust)
    model = ML_Engine.load_model("logistics_v9")
    
    # 3M de eventos geolocalizados por segundo
    predictions = model.predict_batch(stream.get_tensors())
    
    if predictions.collision_probability > 0.9:
        return trigger_fail_safe_protocol(predictions.node)`,
    cloud: `# Terraform: Despliegue Multi-Nube B2B
resource "aws_eks_cluster" "luxen_k8s" {
  name     = "luxen-core-banking-prod"
  role_arn = aws_iam_role.cluster_role.arn

  vpc_config {
    subnet_ids = var.private_subnets
    endpoint_private_access = true
  }
}
# Infraestructura inmutable. Despliegue en 4 minutos.`
  };

  useEffect(() => {
    setTypedText('');
    const fullText = snippets[activeLogic];
    let i = 0;
    
    // Simular tipeo súper rápido para mantener el impacto sin aburrir
    const typingInterval = setInterval(() => {
      setTypedText(prev => prev + fullText.charAt(i));
      i++;
      if (i >= fullText.length) clearInterval(typingInterval);
    }, 15);

    return () => clearInterval(typingInterval);
  }, [activeLogic]);

  return (
    <section className="py-20 bg-slate-950 flex justify-center">
      <div className="w-full max-w-5xl px-6">
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* Navegación Consola */}
          <div className="md:w-1/4 flex flex-col gap-3">
            <h4 className="text-slate-500 font-mono text-sm tracking-widest mb-4">MÓDULO.INGENIERÍA</h4>
            <button 
              onClick={() => setActiveLogic('ciber')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${activeLogic === 'ciber' ? 'bg-slate-900 border-slate-700 shadow-inner' : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400'}`}
            >
              <Shield className={`w-4 h-4 ${activeLogic === 'ciber' ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span className="font-mono text-sm">Auth.js</span>
            </button>
            <button 
              onClick={() => setActiveLogic('cloud')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${activeLogic === 'cloud' ? 'bg-slate-900 border-slate-700 shadow-inner' : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400'}`}
            >
              <Workflow className={`w-4 h-4 ${activeLogic === 'cloud' ? 'text-orange-400' : 'text-slate-600'}`} />
              <span className="font-mono text-sm">Terraform.tf</span>
            </button>
            <button 
              onClick={() => setActiveLogic('ai')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${activeLogic === 'ai' ? 'bg-slate-900 border-slate-700 shadow-inner' : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400'}`}
            >
              <Cpu className={`w-4 h-4 ${activeLogic === 'ai' ? 'text-cyan-400' : 'text-slate-600'}`} />
              <span className="font-mono text-sm">Motor_IA.py</span>
            </button>
          </div>

          {/* Editor/Terminal Windows */}
          <div className="md:w-3/4 bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-slate-800">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              <div className="ml-4 flex items-center gap-2">
                <Terminal className="w-3 h-3 text-slate-500" />
                <span className="font-mono text-xs text-slate-500 font-medium">luxen_core_production ~ root</span>
              </div>
            </div>
            <div className="p-6 overflow-x-auto notranslate" translate="no">
              <pre className="font-mono text-sm leading-loose">
                <code className={activeLogic === 'cloud' ? 'text-slate-300' : 'text-emerald-400/90'}>
                  {typedText}
                  <span className="animate-pulse w-2 h-4 bg-amber-500 inline-block align-middle ml-1"></span>
                </code>
              </pre>
            </div>
            
            {/* Watermark de autoridad */}
            <div className="absolute bottom-4 right-4 text-[10px] uppercase tracking-widest font-mono text-slate-700 select-none">
              Arquitectura Privada Luxen E2E
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
