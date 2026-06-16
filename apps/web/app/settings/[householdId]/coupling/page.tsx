'use client';

import { use, useEffect, useState } from 'react';
import { AlertTriangle, Cpu, Database, KeyRound, Plus, RotateCcw, ShieldCheck, Unplug } from 'lucide-react';
import {
  createCouplingGateway,
  listAgentHubEvents,
  listCouplingGateways,
  rotateCouplingGatewayToken,
} from '../../../../lib/api';

type Gateway = {
  id: string;
  provider_type: string;
  status: string;
  last_sync_at?: string | null;
  token_expires_at?: string | null;
  token_rotated_at?: string | null;
  created_at?: string | null;
};

type RevealedToken = {
  gatewayId: string;
  providerType?: string;
  token: string;
  expiresAt?: string | null;
  mode: 'created' | 'rotated';
};

const providers = [
  {
    id: 'whatsapp_cloud',
    title: 'WhatsApp Familiar',
    detail: 'Mensajes, fotos, audios transcritos y recordatorios.',
    accent: 'group-hover:text-emerald-400',
  },
  {
    id: 'microsoft_teams',
    title: 'Microsoft Teams',
    detail: 'Canales, minutas, archivos y acuerdos de equipo.',
    accent: 'group-hover:text-sky-400',
  },
  {
    id: 'google_drive',
    title: 'Google Drive',
    detail: 'Carpetas, documentos, calendarios y respaldo.',
    accent: 'group-hover:text-lime-400',
  },
  {
    id: 'gmail',
    title: 'Gmail / Correo',
    detail: 'Adjuntos, circulares, vencimientos y solicitudes.',
    accent: 'group-hover:text-rose-400',
  },
  {
    id: 'school_calendar_upload',
    title: 'Agenda escolar (Familiar)',
    detail: 'Canal del planificador familiar para pruebas, ramos y trabajos.',
    accent: 'group-hover:text-amber-400',
  },
  {
    id: 'sap_erp_webhook',
    title: 'SAP S/4HANA',
    detail: 'Webhook HTTP para eventos OData.',
    accent: 'group-hover:text-amber-400',
  },
  {
    id: 'aconex_oracle_api',
    title: 'Aconex / Oracle P6',
    detail: 'Sincronizacion de curvas S y avance.',
    accent: 'group-hover:text-indigo-400',
  },
  {
    id: 'sftp_cold_dump',
    title: 'Buzon SFTP',
    detail: 'Ingesta asincrona para CSV/XLSX legados.',
    accent: 'group-hover:text-emerald-400',
  },
];

type AgentEvent = {
  id: string;
  trace_id?: string;
  provider_type: string;
  event_type: string;
  summary: string;
  status: string;
  created_at: string;
  alert_id?: string;
  task_ids?: string[];
  audit_id?: string;
  assistant_action_id?: string;
  actions?: Array<{ title?: string; task_id?: string; type?: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return 'Pendiente';
  return new Date(value).toLocaleString();
}

function providerLabel(providerType: string) {
  return providerType.replace(/_/g, ' ');
}

export default function CouplingPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = use(params);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<RevealedToken | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);

  const fetchGateways = async () => {
    setError(null);
    try {
      const resp = await listCouplingGateways(householdId);
      setGateways(resp.gateways || []);
      const eventResp = await listAgentHubEvents(householdId, 12);
      setAgentEvents(eventResp.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de pasarelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, [householdId]);

  const addGateway = async (providerType: string) => {
    setWorkingId(providerType);
    setError(null);
    try {
      const resp = await createCouplingGateway(householdId, {
        provider_type: providerType,
        status: 'active',
        meta: {},
      });
      setRevealedToken({
        gatewayId: resp.id,
        providerType,
        token: resp.auth_token,
        expiresAt: resp.token_expires_at,
        mode: 'created',
      });
      await fetchGateways();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la pasarela.');
    } finally {
      setWorkingId(null);
    }
  };

  const rotateToken = async (gateway: Gateway) => {
    setWorkingId(gateway.id);
    setError(null);
    try {
      const resp = await rotateCouplingGatewayToken(householdId, gateway.id);
      setRevealedToken({
        gatewayId: resp.id,
        providerType: gateway.provider_type,
        token: resp.auth_token,
        expiresAt: resp.token_expires_at,
        mode: 'rotated',
      });
      await fetchGateways();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rotar el token.');
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) return <div>Cargando integraciones...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">Integraciones y canales</h1>
        <p className="text-sm text-slate-400">
          Conecta WhatsApp, Teams, Google Drive, correo, documentos y sistemas externos. Cada evento entra al hub,
          VantIA lo clasifica segun la configuracion de Agentes IA, genera alertas/tareas cuando corresponde y deja evidencia auditada.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          ['Escucha', 'Recibe mensajes, archivos o eventos externos.'],
          ['Clasifica', 'Detecta si es agenda escolar, gasto, salud o documento.'],
          ['Actua', 'Crea tarea, alerta o pendiente de revision.'],
          ['Audita', 'Registra accion IA con origen y trazabilidad.'],
        ].map(([title, detail]) => (
          <div key={title} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-emerald-300 font-bold">{title}</div>
            <div className="text-xs text-slate-400 mt-2">{detail}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="border border-red-500/40 bg-red-950/30 text-red-200 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {revealedToken && (
        <div className="border border-amber-500/40 bg-amber-950/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-200 font-semibold">
            <KeyRound className="w-4 h-4" />
            Token {revealedToken.mode === 'created' ? 'creado' : 'rotado'} para {providerLabel(revealedToken.providerType || 'gateway')}
          </div>
          <div className="mt-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-md p-3 text-amber-100 select-all break-all">
            {revealedToken.token}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Se muestra solo una vez. Vence: {formatDate(revealedToken.expiresAt)}
          </div>
          <div className="mt-3 text-xs text-slate-300">
            Webhook de entrada: <span className="font-mono text-amber-100">/coupling/webhook/{revealedToken.gatewayId}</span>
          </div>
        </div>
      )}

      {gateways.length > 0 ? (
        <div className="grid gap-4">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-200 capitalize">{providerLabel(gateway.provider_type)} conector</h3>
                    <div className="text-xs font-mono text-slate-500 mt-1 break-all">ID: {gateway.id}</div>
                    <div className="text-xs text-emerald-400 mt-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Estado: {gateway.status.toUpperCase()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => rotateToken(gateway)}
                  disabled={workingId === gateway.id}
                  className="inline-flex items-center justify-center gap-2 bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm font-semibold transition-colors"
                  title="Rotar token"
                >
                  <RotateCcw className="w-4 h-4" />
                  {workingId === gateway.id ? 'Rotando...' : 'Rotar token'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 text-xs">
                <div className="bg-slate-950/60 border border-slate-800 rounded-md p-3">
                  <div className="text-slate-500 uppercase">Ultima sincronizacion</div>
                  <div className="text-slate-200 mt-1">{formatDate(gateway.last_sync_at)}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-md p-3">
                  <div className="text-slate-500 uppercase">Token vence</div>
                  <div className="text-slate-200 mt-1">{formatDate(gateway.token_expires_at)}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-md p-3">
                  <div className="text-slate-500 uppercase">Ultima rotacion</div>
                  <div className="text-slate-200 mt-1">{formatDate(gateway.token_rotated_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-lg text-slate-400">
          <Unplug className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No existen pasarelas de acoplamiento activas.</p>
        </div>
      )}

      <div className="pt-8 mt-8 border-t border-slate-800">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          Activar conector
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => addGateway(provider.id)}
              disabled={workingId === provider.id}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-700 p-4 rounded-lg text-left transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-500" />
                <h4 className={`font-bold text-slate-200 transition-colors ${provider.accent}`}>{provider.title}</h4>
              </div>
              <p className="text-xs text-slate-500 mt-2">{workingId === provider.id ? 'Creando...' : provider.detail}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-8 mt-8 border-t border-slate-800">
        <h2 className="text-xl font-bold mb-4">Actividad reciente del agente</h2>
        {agentEvents.length > 0 ? (
          <div className="grid gap-3">
            {agentEvents.map((event) => (
              <div key={event.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-100">{event.summary}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {providerLabel(event.provider_type)} · {event.event_type} · {formatDate(event.created_at)}
                    </div>
                    {event.trace_id ? (
                      <div className="text-xs font-mono text-amber-200 mt-2 select-all">
                        trace: {event.trace_id}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs border border-emerald-500/40 text-emerald-300 rounded-full px-3 py-1 w-fit">
                    {event.status}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                  <div className="text-xs bg-slate-950/60 border border-slate-800 rounded-md p-2">
                    <span className="text-slate-500">Alerta</span>
                    <div className="font-mono text-slate-300">{event.alert_id ? event.alert_id.slice(0, 8) : 'pendiente'}</div>
                  </div>
                  <div className="text-xs bg-slate-950/60 border border-slate-800 rounded-md p-2">
                    <span className="text-slate-500">Tareas</span>
                    <div className="font-mono text-slate-300">{event.task_ids?.length || 0}</div>
                  </div>
                  <div className="text-xs bg-slate-950/60 border border-slate-800 rounded-md p-2">
                    <span className="text-slate-500">Auditoria</span>
                    <div className="font-mono text-slate-300">{event.audit_id ? event.audit_id.slice(0, 8) : 'pendiente'}</div>
                  </div>
                  <div className="text-xs bg-slate-950/60 border border-slate-800 rounded-md p-2">
                    <span className="text-slate-500">Accion IA</span>
                    <div className="font-mono text-slate-300">{event.assistant_action_id ? event.assistant_action_id.slice(0, 8) : 'pendiente'}</div>
                  </div>
                </div>
                {(event.actions || []).length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {(event.actions || []).map((action, idx) => (
                      <div key={`${event.id}-${idx}`} className="text-xs bg-slate-950/60 border border-slate-800 rounded-md p-2 text-slate-300">
                        {action.title || action.type}
                        {action.task_id ? <span className="text-slate-500"> · tarea {action.task_id.slice(0, 8)}</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-lg text-slate-400">
            Aun no hay eventos externos procesados por el agente.
          </div>
        )}
      </div>
    </div>
  );
}
