'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Bot, BrainCircuit, CheckCircle2, ClipboardList, Layers3, LockKeyhole, Mic, Route, Save, ShieldCheck, Square, Volume2 } from 'lucide-react';
import { getAgentSettings, getVoiceAudioStatus, synthesizeVoiceSpeech, transcribeVoiceAudio, updateAgentSettings } from '../../../../lib/api';

type AgentSettings = {
  user_level: 'basic' | 'medium' | 'advanced';
  autonomy_mode: 'consult' | 'analyze' | 'execute' | 'forensic' | 'automatic';
  imported_context: string;
  active_agents: string[];
  approval_required: boolean;
  audio_input_enabled: boolean;
  audio_output_enabled: boolean;
};

const levels = [
  {
    id: 'basic',
    title: 'Basico',
    detail: 'El agente guia, resume y sugiere. No ejecuta acciones sin que el usuario decida.',
  },
  {
    id: 'medium',
    title: 'Medio',
    detail: 'El agente analiza documentos, propone tareas, prepara informes y mantiene trazabilidad resumida.',
  },
  {
    id: 'advanced',
    title: 'Avanzado',
    detail: 'El agente opera como workspace: coordina agentes, integra canales y permite flujos con aprobacion.',
  },
] as const;

const modes = [
  { id: 'consult', title: 'Consultar', detail: 'Responder dudas y orientar.' },
  { id: 'analyze', title: 'Analizar', detail: 'Cruzar documentos, eventos y KPI.' },
  { id: 'execute', title: 'Ejecutar', detail: 'Crear tareas, alertas e informes con aprobacion.' },
  { id: 'forensic', title: 'Forense', detail: 'Trabajar con evidencia, claims, trazabilidad y cero invencion.' },
  { id: 'automatic', title: 'Automatico', detail: 'Solo avanzado: ejecutar flujos aprobados dentro de VantDomus.' },
] as const;

const agentCatalog = [
  {
    id: 'family_orchestrator',
    title: 'Orquestador familiar',
    scope: 'family',
    detail: 'Coordina agenda, compras, salud, presupuesto, documentos y acuerdos del hogar.',
  },
  {
    id: 'school_planner',
    title: 'Planificador escolar',
    scope: 'family',
    detail: 'Lee calendarios de pruebas, ramos, tareas y trabajos para generar recordatorios y avance de estudio.',
  },
  {
    id: 'budget_guard',
    title: 'Control de presupuesto',
    scope: 'family',
    detail: 'Ordena gastos, vencimientos, beneficios, seguros y oportunidades de ahorro.',
  },
  {
    id: 'wellbeing_guard',
    title: 'Bienestar y cuidado',
    scope: 'family',
    detail: 'Controla medicamentos, controles, descanso, cuidado senior y alertas preventivas.',
  },
  {
    id: 'document_guard',
    title: 'Repositorio documental',
    scope: 'shared',
    detail: 'Clasifica documentos, vencimientos, polizas, contratos, boletas, garantias y evidencia.',
  },
  {
    id: 'executive_orchestrator',
    title: 'Orquestador ejecutivo',
    scope: 'enterprise',
    detail: 'Resume estado, riesgos, decisiones, responsables y proximos movimientos.',
  },
  {
    id: 'task_planner',
    title: 'Planificador de unidades',
    scope: 'enterprise',
    detail: 'Controla unidades, hitos, responsables, pendientes, programa y desviaciones.',
  },
  {
    id: 'finance_controller',
    title: 'Control financiero',
    scope: 'enterprise',
    detail: 'Analiza presupuesto, gastos, GG, HH, margen, recuperabilidad y escenarios.',
  },
  {
    id: 'document_forensic',
    title: 'Motor forense documental',
    scope: 'enterprise',
    detail: 'Analiza contratos, licitaciones, evidencia, claims, NOC y matriz probatoria.',
  },
  {
    id: 'integration_router',
    title: 'Router de integraciones',
    scope: 'shared',
    detail: 'Recibe eventos de WhatsApp, Teams, Drive, correo y webhooks; clasifica y deja trazabilidad.',
  },
];

function defaultSettings(): AgentSettings {
  return {
    user_level: 'basic',
    autonomy_mode: 'consult',
    imported_context: '',
    active_agents: ['family_orchestrator', 'school_planner', 'budget_guard', 'document_guard', 'wellbeing_guard'],
    approval_required: true,
    audio_input_enabled: true,
    audio_output_enabled: true,
  };
}

export default function AgentsPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = use(params);
  const [settings, setSettings] = useState<AgentSettings>(defaultSettings());
  const [industry, setIndustry] = useState('default');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsMode, setTtsMode] = useState<'cloud' | 'browser'>('cloud');
  const [voiceStatus, setVoiceStatus] = useState<{
    configured?: boolean;
    production_ready?: boolean;
    keys_mode?: string;
    secret_manager?: string;
    stt_model?: string;
    tts_model?: string;
    tts_voice?: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    getAgentSettings(householdId)
      .then((resp) => {
        if (!alive) return;
        setIndustry(resp.industry_preset || 'default');
        setSettings({ ...defaultSettings(), ...(resp.agent_settings || {}) });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la configuracion de agentes.'))
      .finally(() => alive && setLoading(false));
    getVoiceAudioStatus()
      .then((resp) => alive && setVoiceStatus(resp))
      .catch(() => alive && setVoiceStatus({ configured: false }));
    return () => {
      alive = false;
    };
  }, [householdId]);

  const isFamily =
    industry === 'family' ||
    settings.active_agents.some((id) => ['family_orchestrator', 'school_planner', 'budget_guard', 'wellbeing_guard'].includes(id));
  const visibleAgents = useMemo(() => {
    return agentCatalog.filter((agent) => agent.scope === 'shared' || agent.scope === (isFamily ? 'family' : 'enterprise'));
  }, [isFamily]);

  const toggleAgent = (id: string) => {
    setSettings((prev) => {
      const active = new Set(prev.active_agents || []);
      if (active.has(id)) active.delete(id);
      else active.add(id);
      return { ...prev, active_agents: Array.from(active) };
    });
  };

  const audioAvailable = typeof window !== 'undefined' && ('speechSynthesis' in window || 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  const startDictation = () => {
    setError(null);
    setVoiceNote(null);
    const SpeechRecognitionCtor = typeof window !== 'undefined'
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;
    if (!SpeechRecognitionCtor) {
      setVoiceNote('El navegador no expone reconocimiento de voz. Puedes usar dictado del sistema o escribir las instrucciones.');
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-CL';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => {
      setListening(false);
      setVoiceNote('No se pudo capturar audio. Revisa permisos de microfono del navegador.');
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      setSettings((prev) => ({
        ...prev,
        imported_context: `${prev.imported_context || ''}${prev.imported_context ? '\n' : ''}Instruccion por voz: ${transcript}`,
      }));
      setVoiceNote('Instruccion por voz agregada a la memoria importada.');
    };
    recognition.start();
  };

  const speakSummary = () => {
    setError(null);
    const agentNames = visibleAgents
      .filter((agent) => settings.active_agents.includes(agent.id))
      .map((agent) => agent.title)
      .join(', ');
    const text =
      `VantIA esta configurado en nivel ${settings.user_level}, modo ${settings.autonomy_mode}. ` +
      `Agentes activos: ${agentNames || 'orquestador principal'}. ` +
      `${settings.approval_required ? 'Toda accion relevante requiere aprobacion humana.' : 'Puede ejecutar acciones aprobadas dentro de VantDomus.'}`;
    if (ttsMode === 'cloud') {
      setSpeaking(true);
      synthesizeVoiceSpeech(householdId, text)
        .then((resp) => {
          const audio = new Audio(`data:${resp.mime_type};base64,${resp.audio_base64}`);
          audio.onended = () => setSpeaking(false);
          audio.onerror = () => {
            setSpeaking(false);
            setVoiceNote('No se pudo reproducir la voz cloud. Puedes usar voz del navegador.');
          };
          audio.play();
          setVoiceNote(`Voz generada con ${resp.provider} (${resp.model}). Trace: ${resp.trace_id}`);
        })
        .catch((err) => {
          setSpeaking(false);
          setVoiceNote(err instanceof Error ? `${err.message}. Cambia a voz navegador si aun no hay API key.` : 'No se pudo generar voz cloud.');
        });
      return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceNote('El navegador no permite reproducir voz en esta sesion.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CL';
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setVoiceNote('No se pudo reproducir el audio.');
    };
    window.speechSynthesis.speak(utterance);
  };

  const transcribeUploadedAudio = async () => {
    if (!audioFile) {
      setVoiceNote('Selecciona un archivo de audio primero.');
      return;
    }
    setTranscribing(true);
    setError(null);
    setVoiceNote(null);
    try {
      const fd = new FormData();
      fd.set('file', audioFile);
      fd.set('source', 'manual_upload');
      fd.set('language', 'es');
      const resp = await transcribeVoiceAudio(householdId, fd);
      setSettings((prev) => ({
        ...prev,
        imported_context: `${prev.imported_context || ''}${prev.imported_context ? '\n' : ''}Transcripcion de audio (${resp.source}, ${resp.trace_id}): ${resp.text}`,
      }));
      setVoiceNote(`Audio transcrito con ${resp.provider} (${resp.model}). Trace: ${resp.trace_id}`);
    } catch (err) {
      setVoiceNote(err instanceof Error ? err.message : 'No se pudo transcribir el audio.');
    } finally {
      setTranscribing(false);
    }
  };

  const stopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setListening(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        ...settings,
        active_agents: settings.active_agents.filter((id) => visibleAgents.some((agent) => agent.id === id)),
      };
      const resp = await updateAgentSettings(householdId, payload);
      setSettings(resp.agent_settings || payload);
      setMessage('Configuracion guardada. VantIA usara este perfil en sus respuestas y acciones.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando agentes IA...</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-emerald-300 text-sm font-bold uppercase tracking-wide">{isFamily ? 'Ajustes del Hogar' : 'Ajustes Cliente'}</div>
            <h1 className="text-3xl font-black mt-2">{isFamily ? 'Asistente Domi — Ajustes' : 'Agentes IA VantDomus'}</h1>
            <p className="text-slate-400 mt-3 max-w-3xl">
              {isFamily
                ? 'Domi es la cara visible de tu Guía Familiar. Aquí podés ajustar qué tan autónomo es y qué agentes especializados acompañan al hogar (estudio, salud, presupuesto, documentos). La IA real ordena y propone, pero las decisiones importantes siempre pasan por una persona.'
                : 'Configura un workspace tipo Codex, Claude Code, Cursor o Antigravity, pero limitado a lo que VantDomus ofrece: familia, oficina tecnica, documentos, presupuesto, tareas, evidencia, integraciones y trazabilidad.'}
            </p>
          </div>
          <div className="border border-emerald-500/40 rounded-full px-4 py-2 text-emerald-200 text-sm font-bold">
            {isFamily ? 'Modo Familiar' : 'VantDomus Operativo'}
          </div>
        </div>
      </div>

      {error && <div className="border border-red-500/40 bg-red-950/30 text-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {message && <div className="border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 rounded-lg px-4 py-3 text-sm">{message}</div>}

      <section className="bg-slate-950 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-emerald-300" />
              <h2 className="text-xl font-black">Audio del agente</h2>
            </div>
            <p className="text-sm text-slate-400 mt-2 max-w-3xl">
              Permite dictar instrucciones para configurar el agente y escuchar resumenes operativos. Esto corre en el navegador; para produccion se puede conectar a voz cloud, WhatsApp audio o transcripcion OCR/audio.
            </p>
            <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${voiceStatus?.configured ? 'border-emerald-500/50 text-emerald-200' : 'border-amber-500/50 text-amber-200'}`}>
              {voiceStatus?.configured
                ? `STT/TTS cloud activo: ${voiceStatus.stt_model} / ${voiceStatus.tts_model}`
                : 'STT/TTS cloud pendiente de OPENAI_API_KEY'}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Productivo: {voiceStatus?.keys_mode || 'platform'} · secretos: {voiceStatus?.secret_manager || 'env'} · {voiceStatus?.production_ready ? 'listo' : 'pendiente de secreto backend'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={startDictation}
              disabled={!settings.audio_input_enabled || listening}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/25 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              {listening ? 'Escuchando...' : 'Dictar instruccion'}
            </button>
            <button
              onClick={speakSummary}
              disabled={!settings.audio_output_enabled || speaking}
              className="inline-flex items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-950/25 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
            >
              <Volume2 className="w-4 h-4" />
              {speaking ? 'Reproduciendo...' : 'Escuchar resumen'}
            </button>
            <button
              onClick={stopAudio}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"
            >
              <Square className="w-4 h-4" />
              Detener
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
            <input
              type="checkbox"
              checked={settings.audio_input_enabled}
              onChange={(event) => setSettings((prev) => ({ ...prev, audio_input_enabled: event.target.checked }))}
            />
            Recibir instrucciones por voz
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
            <input
              type="checkbox"
              checked={settings.audio_output_enabled}
              onChange={(event) => setSettings((prev) => ({ ...prev, audio_output_enabled: event.target.checked }))}
            />
            Reproducir respuestas de los agentes
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="font-bold text-slate-100">Transcripcion real desde audio subido</div>
          <p className="text-xs text-slate-400 mt-1">
            Sube audio de WhatsApp, Teams, nota de voz o reunion. VantDomus lo envia al servicio STT configurado y guarda trazabilidad.
          </p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              type="file"
              accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg"
              onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
            />
            <button
              onClick={transcribeUploadedAudio}
              disabled={!audioFile || transcribing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/25 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              {transcribing ? 'Transcribiendo...' : 'Transcribir audio'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => setTtsMode('cloud')}
              className={`rounded-full border px-3 py-1 ${ttsMode === 'cloud' ? 'border-sky-300 text-sky-100 bg-sky-950/40' : 'border-slate-700 text-slate-400'}`}
            >
              Voz cloud STT/TTS
            </button>
            <button
              onClick={() => setTtsMode('browser')}
              className={`rounded-full border px-3 py-1 ${ttsMode === 'browser' ? 'border-sky-300 text-sky-100 bg-sky-950/40' : 'border-slate-700 text-slate-400'}`}
            >
              Voz navegador
            </button>
          </div>
        </div>
        {!audioAvailable && (
          <div className="mt-3 text-xs text-amber-200">
            Este navegador puede tener audio limitado. La configuracion queda lista para conectar servicios externos de voz.
          </div>
        )}
        {voiceNote && <div className="mt-3 text-xs text-slate-300">{voiceNote}</div>}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {levels.map((level) => {
          const active = settings.user_level === level.id;
          return (
            <button
              key={level.id}
              onClick={() => setSettings((prev) => ({ ...prev, user_level: level.id }))}
              className={`text-left rounded-xl border p-5 transition-colors ${active ? 'border-emerald-400 bg-emerald-950/25' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-black text-xl">{level.title}</div>
                {active ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <LockKeyhole className="w-5 h-5 text-slate-500" />}
              </div>
              <p className="text-sm text-slate-400 mt-3">{level.detail}</p>
            </button>
          );
        })}
      </section>

      <section className="bg-slate-950 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <Route className="w-5 h-5 text-amber-300" />
          <h2 className="text-xl font-black">Modo de operacion</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {modes.map((mode) => {
            const disabled = mode.id === 'automatic' && settings.user_level !== 'advanced';
            const active = settings.autonomy_mode === mode.id;
            return (
              <button
                key={mode.id}
                disabled={disabled}
                onClick={() => setSettings((prev) => ({ ...prev, autonomy_mode: mode.id }))}
                className={`text-left rounded-lg border p-4 min-h-32 ${active ? 'border-amber-400 bg-amber-950/20' : 'border-slate-800 bg-slate-900'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-600'}`}
              >
                <div className="font-bold text-slate-100">{mode.title}</div>
                <div className="text-xs text-slate-400 mt-2">{mode.detail}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-950 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <Layers3 className="w-5 h-5 text-sky-300" />
          <h2 className="text-xl font-black">Agentes especializados</h2>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          {isFamily
            ? 'El planificador escolar pertenece a VantDomus Familiar: calendarios de pruebas, ramos, trabajos y recordatorios familiares.'
            : 'Los agentes se acotan a oficina tecnica, unidades, documentos, tareas, finanzas, claims e integraciones del cliente.'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleAgents.map((agent) => {
            const active = settings.active_agents.includes(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`text-left rounded-xl border p-4 transition-colors ${active ? 'border-sky-400 bg-sky-950/20' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-black text-slate-100">{agent.title}</div>
                  {active ? <CheckCircle2 className="w-5 h-5 text-sky-300 shrink-0" /> : <Bot className="w-5 h-5 text-slate-500 shrink-0" />}
                </div>
                <p className="text-xs text-slate-400 mt-3">{agent.detail}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit className="w-5 h-5 text-fuchsia-300" />
            <h2 className="text-xl font-black">Memoria importada del agente</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {isFamily
              ? 'Pegá aquí instrucciones, recordatorios o reglas que querés que Domi tenga presentes en este hogar. La memoria sensible vive en VantDomus, no en el modelo.'
              : 'Pega aqui instrucciones de ChatGPT, Codex, Claude Projects, Cursor Rules, Gemini Gems o procedimientos internos. VantDomus no copia memoria privada externa; replica la configuracion explicita dentro de este ambiente.'}
          </p>
          <textarea
            value={settings.imported_context || ''}
            onChange={(event) => setSettings((prev) => ({ ...prev, imported_context: event.target.value }))}
            className="w-full min-h-56 bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
            placeholder="Ejemplo: Responde como asistente familiar. Prioriza recordatorios escolares, salud, presupuesto y documentos. No ejecutes acciones sin confirmacion..."
          />
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
            <h2 className="text-xl font-black">Gobierno y trazabilidad</h2>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.approval_required}
              onChange={(event) => setSettings((prev) => ({ ...prev, approval_required: event.target.checked }))}
              className="mt-1"
            />
            <span>
              <span className="block font-bold">Requerir aprobacion humana</span>
              <span className="block text-xs text-slate-400 mt-1">
                Toda accion relevante queda en bitacora con origen, agente, evidencia y usuario aprobador.
              </span>
            </span>
          </label>

          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 font-bold text-slate-100">
              <ClipboardList className="w-4 h-4 text-amber-300" />
              Como operara VantIA
            </div>
            <ul className="text-sm text-slate-400 mt-3 space-y-2">
              <li>1. Recibe pregunta, documento o evento externo.</li>
              <li>2. Selecciona el agente especializado.</li>
              <li>3. Usa solo fuentes y herramientas de VantDomus.</li>
              <li>4. Propone o ejecuta segun nivel y modo.</li>
              <li>5. Registra trazabilidad completa.</li>
            </ul>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-slate-950 font-black hover:bg-emerald-400 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar agentes IA'}
          </button>
        </div>
      </section>
    </div>
  );
}
