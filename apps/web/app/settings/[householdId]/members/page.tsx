'use client';

import { use, useEffect, useState } from 'react';
import {
  acceptHouseholdInvitation,
  addHouseholdMember,
  createHouseholdInvitation,
  listHouseholdMembers,
  listHouseholdInvitations,
  removeHouseholdMember,
  revokeHouseholdInvitation,
  updateHouseholdMemberRole,
} from '../../../../lib/api';

type Member = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  last_seen_at?: string | null;
  active_sessions?: number;
  presence?: 'online' | 'recent' | 'offline';
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
};

const roles = ['viewer', 'member', 'admin', 'owner'];
const familyRoleLabels: Record<string, string> = {
  viewer: 'Solo lectura',
  member: 'Integrante',
  admin: 'Administrador familiar',
  owner: 'Responsable principal',
};

const presenceLabels: Record<string, string> = {
  online: 'Conectado ahora',
  recent: 'Activo hace poco',
  offline: 'Desconectado',
};

const presenceColors: Record<string, string> = {
  online: '#10b981',
  recent: '#f59e0b',
  offline: '#64748b',
};

export default function MembersPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = use(params);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      const resp = await listHouseholdMembers(householdId);
      setMembers(resp.items || []);
      try {
        const inviteResp = await listHouseholdInvitations(householdId);
        setInvitations(inviteResp.items || []);
      } catch {
        setInvitations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los miembros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('invite');
    if (!token) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    acceptHouseholdInvitation(token)
      .then(async () => {
        setMessage('Invitacion aceptada. Este usuario ya puede colaborar en el nucleo familiar.');
        window.history.replaceState(null, '', `/settings/${householdId}/members`);
        await refresh();
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitacion.');
      })
      .finally(() => setWorking(false));
  }, [householdId]);

  const addMember = async () => {
    if (!email.trim()) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await addHouseholdMember(householdId, { email: email.trim(), role });
      setEmail('');
      setRole('viewer');
      setMessage('Miembro agregado.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el miembro.');
    } finally {
      setWorking(false);
    }
  };

  const updateRole = async (userId: string, nextRole: string) => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await updateHouseholdMemberRole(householdId, userId, nextRole);
      setMessage('Rol actualizado.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el rol.');
    } finally {
      setWorking(false);
    }
  };

  const removeMember = async (userId: string) => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await removeHouseholdMember(householdId, userId);
      setMessage('Acceso retirado.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo retirar el acceso.');
    } finally {
      setWorking(false);
    }
  };

  const createInvitation = async () => {
    if (!inviteEmail.trim()) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    setInviteToken(null);
    try {
      const resp = await createHouseholdInvitation(householdId, {
        email: inviteEmail.trim(),
        role: inviteRole,
        ttl_hours: 168,
      });
      setInviteEmail('');
      setInviteRole('viewer');
      setInviteToken(resp.token);
      setMessage('Invitacion creada. Comparte este enlace con el integrante familiar.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la invitacion.');
    } finally {
      setWorking(false);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await revokeHouseholdInvitation(householdId, invitationId);
      setMessage('Invitacion revocada.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar la invitacion.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div>Cargando miembros...</div>;
  const inviteLink = inviteToken && typeof window !== 'undefined'
    ? `${window.location.origin}/login?next=${encodeURIComponent(`/settings/${householdId}/members?invite=${inviteToken}`)}`
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">Grupo familiar conectado</h1>
        <p className="text-sm text-slate-400">
          Invita a cada integrante con su propia cuenta. Todos pueden entrar al mismo nucleo familiar al mismo tiempo, con permisos y trazabilidad por usuario.
        </p>
      </div>

      <a href={`/settings/${householdId}`} className="text-sm text-indigo-300 hover:text-indigo-200">
        Volver a configuracion
      </a>

      {error && <div className="border border-red-500/40 bg-red-950/30 text-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {message && <div className="border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 rounded-lg px-4 py-3 text-sm">{message}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h2 className="text-xl font-bold">Agregar integrante ya registrado</h2>
        <p className="text-sm text-slate-400 mt-1">Usa esta opcion cuando la persona ya creo su usuario en VantDomus.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input
            className="input"
            type="email"
            placeholder="correo@familia.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <select className="input" value={role} onChange={e => setRole(e.target.value)}>
            {roles.map(item => (
              <option key={item} value={item}>{familyRoleLabels[item]}</option>
            ))}
          </select>
          <button
            onClick={addMember}
            disabled={working || !email.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Agregar
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h2 className="text-xl font-bold">Invitar a un familiar</h2>
        <p className="text-sm text-slate-400 mt-1">Genera un enlace de invitacion. El familiar inicia sesion o se registra y queda conectado al mismo nucleo.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input
            className="input"
            type="email"
            placeholder="correo@familia.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
          />
          <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            {roles.map(item => (
              <option key={item} value={item}>{familyRoleLabels[item]}</option>
            ))}
          </select>
          <button
            onClick={createInvitation}
            disabled={working || !inviteEmail.trim()}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Crear acceso familiar
          </button>
        </div>
        {inviteToken && inviteLink && (
          <div className="mt-4 border border-amber-500/40 bg-amber-950/20 rounded-lg p-4">
            <div className="text-sm text-amber-100 font-semibold mb-2">Enlace de acceso familiar</div>
            <input className="input font-mono text-xs" readOnly value={inviteLink} onFocus={e => e.currentTarget.select()} />
            <div className="text-xs text-amber-100/70 mt-2">El enlace expira en 7 dias y el token se muestra solo una vez.</div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_150px_170px_120px] gap-3 border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
          <div>Integrante</div>
          <div>Rol</div>
          <div>Conexion</div>
          <div>Acceso</div>
        </div>
        {members.map(member => (
          <div key={member.user_id} className="grid grid-cols-[1fr_150px_170px_120px] gap-3 border-b border-slate-800 px-4 py-3 items-center">
            <div>
              <div className="text-sm font-semibold">{member.email}</div>
              <div className="text-xs text-slate-500">Sesiones activas: {member.active_sessions || 0}</div>
            </div>
            <select
              className="input"
              value={member.role}
              disabled={working}
              onChange={e => updateRole(member.user_id, e.target.value)}
            >
              {roles.map(item => (
                <option key={item} value={item}>{familyRoleLabels[item]}</option>
              ))}
            </select>
            <div>
              <div className="text-sm font-semibold" style={{ color: presenceColors[member.presence || 'offline'] }}>
                ● {presenceLabels[member.presence || 'offline']}
              </div>
              <div className="text-xs text-slate-500">
                {member.last_seen_at ? new Date(member.last_seen_at).toLocaleString() : 'Sin actividad registrada'}
              </div>
            </div>
            <button
              onClick={() => removeMember(member.user_id)}
              disabled={working}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white px-3 py-2 rounded-md text-sm font-semibold"
            >
              Retirar
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_150px_120px] gap-3 border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
          <div>Invitacion</div>
          <div>Rol</div>
          <div>Estado</div>
          <div>Accion</div>
        </div>
        {invitations.map(invitation => {
          const status = invitation.accepted_at ? 'aceptada' : invitation.revoked_at ? 'revocada' : 'pendiente';
          return (
            <div key={invitation.id} className="grid grid-cols-[1fr_120px_150px_120px] gap-3 border-b border-slate-800 px-4 py-3 items-center">
              <div>
                <div className="text-sm font-semibold">{invitation.email}</div>
                <div className="text-xs text-slate-500">Expira: {new Date(invitation.expires_at).toLocaleString()}</div>
              </div>
              <div className="text-sm">{invitation.role}</div>
              <div className="text-sm">{status}</div>
              <button
                onClick={() => revokeInvitation(invitation.id)}
                disabled={working || status !== 'pendiente'}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white px-3 py-2 rounded-md text-sm font-semibold"
              >
                Revocar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
