'use client';

import { use, useEffect, useState } from 'react';
import {
  adminResetMfa,
  changePassword,
  getEmailStatus,
  deleteHouseholdData,
  disableMfa,
  enableMfa,
  exportHouseholdData,
  getMfaStatus,
  listAuthSessions,
  logoutCurrentSession,
  regenerateMfaRecoveryCodes,
  requestEmailVerification,
  revokeAuthSession,
  revokeOtherAuthSessions,
  setupMfa,
  verifyEmail,
} from '../../../../lib/api';

type MfaStatus = {
  is_enabled: boolean;
  is_configured: boolean;
  created_at?: string | null;
  enabled_at?: string | null;
  disabled_at?: string | null;
  recovery_codes_remaining?: number;
};

type MfaSetup = {
  secret: string;
  otpauth_url: string;
  status: string;
};

type EmailStatus = {
  is_verified: boolean;
  email_verified_at?: string | null;
};

type AuthSession = {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at?: string | null;
  current: boolean;
};

export default function SecuritySettingsPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = use(params);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenerateCode, setRegenerateCode] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [manualVerificationToken, setManualVerificationToken] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [dataWorking, setDataWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = async () => {
    setError(null);
    try {
      const resp = await getMfaStatus();
      setStatus(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el estado MFA.');
    } finally {
      setLoading(false);
    }
  };

  const refreshAccountSecurity = async () => {
    try {
      const [emailResp, sessionResp] = await Promise.all([getEmailStatus(), listAuthSessions()]);
      setEmailStatus(emailResp);
      setSessions(sessionResp.items || []);
    } catch {
      setSessions([]);
    }
  };

  useEffect(() => {
    refreshStatus();
    refreshAccountSecurity();
  }, []);

  const startSetup = async () => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await setupMfa();
      setSetup(resp);
      setMessage('Se genero un secreto TOTP. Cargalo en tu app autenticadora y confirma el codigo.');
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar MFA.');
    } finally {
      setWorking(false);
    }
  };

  const confirmEnable = async () => {
    if (!enableCode.trim()) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await enableMfa(enableCode.trim());
      setSetup(null);
      setEnableCode('');
      setRecoveryCodes(resp.recovery_codes || []);
      setMessage('MFA quedo activado para este usuario.');
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Codigo MFA invalido.');
    } finally {
      setWorking(false);
    }
  };

  const regenerateCodes = async () => {
    if (!regenerateCode.trim()) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await regenerateMfaRecoveryCodes(regenerateCode.trim());
      setRegenerateCode('');
      setRecoveryCodes(resp.recovery_codes || []);
      setMessage('Se regeneraron codigos de recuperacion. Guarda estos codigos ahora.');
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron regenerar los codigos.');
    } finally {
      setWorking(false);
    }
  };

  const resetMemberMfa = async () => {
    if (!targetUserId.trim()) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await adminResetMfa(householdId, targetUserId.trim());
      setTargetUserId('');
      setMessage(`MFA reseteado para usuario ${resp.target_user_id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resetear MFA del usuario.');
    } finally {
      setWorking(false);
    }
  };

  const confirmDisable = async () => {
    if (!disableCode.trim()) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await disableMfa(disableCode.trim());
      setDisableCode('');
      setMessage('MFA quedo desactivado para este usuario.');
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar MFA.');
    } finally {
      setWorking(false);
    }
  };

  const submitPasswordChange = async () => {
    if (!currentPassword || !newPassword) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Contrasena actualizada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contrasena.');
    } finally {
      setWorking(false);
    }
  };

  const requestVerification = async () => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await requestEmailVerification();
      setVerificationToken(resp.token || '');
      setMessage(resp.status === 'already_verified' ? 'Email ya verificado.' : 'Token de verificacion generado.');
      await refreshAccountSecurity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo solicitar verificacion.');
    } finally {
      setWorking(false);
    }
  };

  const confirmEmailVerification = async (token: string) => {
    if (!token.trim()) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await verifyEmail(token.trim());
      setVerificationToken('');
      setManualVerificationToken('');
      setMessage('Email verificado correctamente.');
      await refreshAccountSecurity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el email.');
    } finally {
      setWorking(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await revokeAuthSession(sessionId);
      setMessage('Sesion revocada.');
      await refreshAccountSecurity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar la sesion.');
    } finally {
      setWorking(false);
    }
  };

  const revokeOthers = async () => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await revokeOtherAuthSessions();
      setMessage('Otras sesiones revocadas.');
      await refreshAccountSecurity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron revocar otras sesiones.');
    } finally {
      setWorking(false);
    }
  };

  const logout = async () => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      await logoutCurrentSession();
      setMessage('Sesion actual cerrada.');
      await refreshAccountSecurity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la sesion.');
    } finally {
      setWorking(false);
    }
  };

  const exportData = async () => {
    setDataWorking(true);
    setMessage(null);
    setError(null);
    try {
      const payload = await exportHouseholdData(householdId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vantdomus-export-${householdId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Exportacion generada con secretos y rutas privadas redactadas.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar la informacion del cliente.');
    } finally {
      setDataWorking(false);
    }
  };

  const deleteData = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDataWorking(true);
    setMessage(null);
    setError(null);
    try {
      await deleteHouseholdData(householdId);
      setMessage('Datos del cliente eliminados. Redirigiendo...');
      window.setTimeout(() => {
        window.location.href = '/';
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la informacion del cliente.');
    } finally {
      setDataWorking(false);
    }
  };

  if (loading) return <div>Cargando seguridad de usuario...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">Seguridad de Usuario</h1>
        <p className="text-sm text-slate-400">
          Configura doble factor TOTP para proteger acciones sensibles de la plataforma.
        </p>
      </div>

      <a href={`/settings/${householdId}`} className="text-sm text-indigo-300 hover:text-indigo-200">
        Volver a configuracion
      </a>

      {error && (
        <div className="border border-red-500/40 bg-red-950/30 text-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 rounded-lg px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Email</h2>
            <div className="text-sm text-slate-400 mt-1">
              Estado: <span className={emailStatus?.is_verified ? 'text-emerald-300' : 'text-amber-300'}>
                {emailStatus?.is_verified ? 'Verificado' : 'Pendiente'}
              </span>
            </div>
          </div>
          {!emailStatus?.is_verified && (
            <button
              onClick={requestVerification}
              disabled={working}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
            >
              Solicitar verificacion
            </button>
          )}
        </div>
        {!emailStatus?.is_verified && (
          <div className="mt-4 space-y-3">
            {verificationToken && (
              <div className="border border-amber-500/40 bg-amber-950/20 rounded-lg p-4">
                <div className="text-sm text-amber-100 font-semibold mb-2">Token local de verificacion</div>
                <input className="input font-mono text-xs" readOnly value={verificationToken} onFocus={e => e.currentTarget.select()} />
                <button
                  onClick={() => confirmEmailVerification(verificationToken)}
                  disabled={working}
                  className="mt-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 px-4 py-2 rounded-md text-sm font-semibold"
                >
                  Verificar con este token
                </button>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="input"
                placeholder="Token de verificacion"
                value={manualVerificationToken}
                onChange={e => setManualVerificationToken(e.target.value)}
              />
              <button
                onClick={() => confirmEmailVerification(manualVerificationToken)}
                disabled={working || !manualVerificationToken.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
              >
                Verificar email
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h2 className="text-xl font-bold">Contrasena</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Contrasena actual"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Nueva contrasena"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <button
            onClick={submitPasswordChange}
            disabled={working || !currentPassword || newPassword.length < 6}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Actualizar contrasena
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Sesiones</h2>
            <div className="text-sm text-slate-400 mt-1">Tokens activos y revocados de esta cuenta.</div>
          </div>
          <button
            onClick={revokeOthers}
            disabled={working}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Revocar otras sesiones
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {sessions.map(session => (
            <div key={session.id} className="flex flex-col gap-3 border border-slate-800 rounded-lg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-xs text-slate-300">{session.id}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Creada {new Date(session.created_at).toLocaleString()} - Expira {new Date(session.expires_at).toLocaleString()}
                </div>
                <div className="text-xs mt-1">
                  {session.revoked_at ? (
                    <span className="text-red-300">Revocada</span>
                  ) : session.current ? (
                    <span className="text-emerald-300">Actual</span>
                  ) : (
                    <span className="text-amber-300">Activa</span>
                  )}
                </div>
              </div>
              {!session.revoked_at && (
                <button
                  onClick={() => session.current ? logout() : revokeSession(session.id)}
                  disabled={working}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
                >
                  {session.current ? 'Cerrar actual' : 'Revocar'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">MFA TOTP</h2>
            <div className="text-sm text-slate-400 mt-1">
              Estado: <span className={status?.is_enabled ? 'text-emerald-300' : 'text-amber-300'}>
                {status?.is_enabled ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {status?.enabled_at && (
              <div className="text-xs text-slate-500 mt-1">Activado: {new Date(status.enabled_at).toLocaleString()}</div>
            )}
            {status?.is_enabled && (
              <div className="text-xs text-slate-500 mt-1">Codigos de recuperacion restantes: {status.recovery_codes_remaining ?? 0}</div>
            )}
          </div>
          {!status?.is_enabled && (
            <button
              onClick={startSetup}
              disabled={working}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
            >
              {working ? 'Preparando...' : 'Configurar MFA'}
            </button>
          )}
        </div>

        {setup && !status?.is_enabled && (
          <div className="mt-5 border border-amber-500/40 bg-amber-950/20 rounded-lg p-4 space-y-3">
            <div className="text-sm text-amber-100 font-semibold">Secreto TOTP</div>
            <input className="input font-mono text-xs" readOnly value={setup.secret} onFocus={e => e.currentTarget.select()} />
            <div className="text-sm text-amber-100 font-semibold">URI para autenticador</div>
            <textarea className="input font-mono text-xs min-h-24" readOnly value={setup.otpauth_url} onFocus={e => e.currentTarget.select()} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="input"
                inputMode="numeric"
                maxLength={6}
                placeholder="Codigo de 6 digitos"
                value={enableCode}
                onChange={e => setEnableCode(e.target.value)}
              />
              <button
                onClick={confirmEnable}
                disabled={working || enableCode.trim().length < 6}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 px-4 py-2 rounded-md text-sm font-semibold"
              >
                Activar MFA
              </button>
            </div>
          </div>
        )}

        {status?.is_enabled && (
          <div className="mt-5 border border-slate-700 rounded-lg p-4 space-y-5">
            {recoveryCodes.length > 0 && (
              <div className="border border-amber-500/40 bg-amber-950/20 rounded-lg p-4">
                <div className="text-sm text-amber-100 font-semibold mb-3">
                  Codigos de recuperacion. Se muestran solo una vez.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recoveryCodes.map(code => (
                    <div key={code} className="font-mono text-sm bg-slate-950 border border-slate-800 rounded px-3 py-2 select-all">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm text-slate-300 mb-3">Regenerar codigos de recuperacion invalida los codigos no usados anteriores.</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Codigo TOTP vigente"
                  value={regenerateCode}
                  onChange={e => setRegenerateCode(e.target.value)}
                />
                <button
                  onClick={regenerateCodes}
                  disabled={working || regenerateCode.trim().length < 6}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
                >
                  Regenerar codigos
                </button>
              </div>
            </div>

            <div>
            <div className="text-sm text-slate-300 mb-3">Para desactivar MFA, ingresa un codigo vigente de tu app autenticadora.</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="input"
                inputMode="numeric"
                maxLength={6}
                placeholder="Codigo de 6 digitos"
                value={disableCode}
                onChange={e => setDisableCode(e.target.value)}
              />
              <button
                onClick={confirmDisable}
                disabled={working || disableCode.trim().length < 6}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
              >
                Desactivar MFA
              </button>
            </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h2 className="text-xl font-bold">Recuperacion asistida por admin</h2>
        <p className="text-sm text-slate-400 mt-1">
          Resetea MFA de un miembro del hogar actual si perdio autenticador y codigos de recuperacion.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="input"
            placeholder="user_id del miembro"
            value={targetUserId}
            onChange={e => setTargetUserId(e.target.value)}
          />
          <button
            onClick={resetMemberMfa}
            disabled={working || !targetUserId.trim()}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Resetear MFA
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Datos del cliente</h2>
            <p className="text-sm text-slate-400 mt-1">
              Exportacion y borrado contractual del hogar actual.
            </p>
          </div>
          <button
            onClick={exportData}
            disabled={dataWorking}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {dataWorking ? 'Procesando...' : 'Exportar JSON'}
          </button>
        </div>

        <div className="mt-5 border border-red-900/70 bg-red-950/20 rounded-lg p-4">
          <h3 className="font-semibold text-red-100">Borrado contractual</h3>
          <p className="text-sm text-red-200/80 mt-1">
            Elimina registros del hogar, bitacoras, enlaces firmados y archivos privados asociados.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="input"
              placeholder="Escribe DELETE"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
            />
            <button
              onClick={deleteData}
              disabled={dataWorking || deleteConfirm !== 'DELETE'}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-semibold"
            >
              Eliminar datos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
