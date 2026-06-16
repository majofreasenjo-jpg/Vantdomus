'use client';

import { TerminalSquare, Check, Copy } from 'lucide-react';
import { useState } from 'react';

export default function SdkDocs() {
  const [activeTab, setActiveTab] = useState<'ts' | 'python'>('ts');
  const [copied, setCopied] = useState(false);

  const codeSnippets = {
    ts: `import { LuxenCore } from '@luxen/sdk';

// 1. Inicializar cliente con túnel encriptado
const luxen = new LuxenCore(process.env.LUXEN_API_KEY, {
  region: 'aws-us-east',
  zeroTrust: true
});

// 2. Interceptar y limpiar payload entrante
export async function POST(req: Request) {
  const securePayload = await luxen.firewall.sanitize(req);
  
  if (securePayload.isBotnet) {
    return luxen.mitigate(403, 'Headless Chrome Footprint');
  }

  // 3. Procesar Core Bancario seguro
  return processFinancialTx(securePayload);
}`,
    python: `from luxen_sdk import CoreClient
import os

# 1. Enlace de telemetría a Kafka Stream
luxen = CoreClient(api_key=os.getenv("LUXEN_API_KEY"))

def stream_handler(batch):
    # 2. Inferencia predictiva de fraudes (AML)
    assessment = luxen.ml.evaluate_risk(batch, model="fin-v2")
    
    for tx in assessment:
        if tx.risk_score > 0.95:
            luxen.network.quarantine(tx.origin_ip)
            
    return luxen.sync_db(batch)`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 bg-slate-950/50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center">
        
        <div className="text-center mb-16 max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">
            Developer Experience de <span className="text-indigo-500">Primer Nivel</span>.
          </h2>
          <p className="text-slate-400 text-lg text-balance">
            Sabemos que el software lo integran ingenieros. Olvídate de manuales arcaicos de PDF; distribuimos SDKs nativos tipados para TypeScript y Python. Integración B2B en menos de 10 líneas de código.
          </p>
        </div>

        {/* Console Window */}
        <div className="w-full max-w-3xl bg-[#0d1117] rounded-xl border border-slate-800 shadow-2xl overflow-hidden notranslate" translate="no">
          
          {/* Header OS */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-slate-800">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('ts')}
                className={`text-xs font-mono px-3 py-1 rounded transition-colors ${activeTab === 'ts' ? 'bg-indigo-500/20 text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
              >
                ZeroTrust.ts
              </button>
              <button 
                onClick={() => setActiveTab('python')}
                className={`text-xs font-mono px-3 py-1 rounded transition-colors ${activeTab === 'python' ? 'bg-indigo-500/20 text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
              >
                ML_Engine.py
              </button>
            </div>
          </div>

          {/* Body pre/code */}
          <div className="relative group">
            <button 
              onClick={handleCopy}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
            
            <pre className="p-6 overflow-x-auto text-sm font-mono leading-loose text-slate-300">
              <code>{codeSnippets[activeTab]}</code>
            </pre>
          </div>
          
          {/* Footer SDK Callout */}
          <div className="border-t border-slate-800 bg-[#161b22] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <TerminalSquare className="w-4 h-4" />
              <span>Instala el motor local:</span>
            </div>
            <code className="bg-black border border-slate-800 px-3 py-1 rounded text-emerald-400 text-xs font-mono select-all">
              {activeTab === 'ts' ? 'npm install @luxen/sdk' : 'pip install luxen-core'}
            </code>
          </div>

        </div>

      </div>
    </section>
  );
}
