# Runbook — Deploy CERRADO del Piloto Familiar (CP1d-FAMILY-PILOT-1a)

> **Objetivo:** entorno online estable y PRIVADO para el piloto de 5 integrantes
> (2 padres + 3 hijos), con **datos sintéticos** hasta que ChatGPT autorice
> PILOT-1b (cuentas familiares reales).
>
> **Frase de control:** *"CP1d-FAMILY-PILOT-1a implementa la puerta, la
> recuperación y el entorno estable; todavía no incorpora a la familia real."*
>
> Este runbook **actualiza y reemplaza** para el piloto al de Sprint C
> (`DEPLOY_DEMO_RUNBOOK.md`), que queda como referencia de la demo pública.

---

## 0. Principios de seguridad (leer antes de tocar nada)

1. **URL privada ≠ URL secreta.** La seguridad NO depende de que nadie conozca
   la URL. Depende de: autenticación obligatoria, **registro público cerrado**,
   HTTPS, cookies seguras, CSRF, **CORS exacto** (un solo origen), noindex y
   rate limits. Asumir siempre que la URL será descubierta.
2. **Los secretos se generan y cargan DIRECTAMENTE en los paneles de
   Render/Vercel.** Nunca por chat, log, commit, doc ni captura. Un secreto que
   toque cualquiera de esos canales está QUEMADO y se rota.
3. **Rotación de secretos históricos (obligatoria antes de invitar a nadie):**
   - `JWT_SECRET` de la demo Sprint C → **generar uno nuevo** para el piloto
     (invalida sesiones de demo: correcto y deseado).
   - `VANTDOMUS_MFA_SECRET_KEY` → nuevo valor de 32+ caracteres.
   - Neon `vantdomus-demo` y `vantdomus_neon` → quemadas (histórico); no reusar.
   - La key de OpenAI expuesta en su momento → revocada; **no reutilizable**.
   - Generación local segura: `python -c "import secrets; print(secrets.token_hex(32))"`.
4. **IA apagada en el piloto:** el orquestador funciona con MockProvider.
   Ninguna llamada externa sin autorización expresa de ChatGPT.
5. **Datos sintéticos** hasta el cierre formal de 1a y la autorización de 1b.

## 1. Rama y promoción

- Rama estable del piloto: **`family-pilot`** (se crea desde el commit que
  ChatGPT apruebe al cierre de 1a; la implementación vive en
  `cp1d-family-pilot-1a`).
- El desarrollo sigue en `develop`/ramas de checkpoint; **promoción semanal por
  tag**: `git tag pilot-YYYY-MM-DD && git push origin pilot-YYYY-MM-DD`, y
  Render/Vercel despliegan la rama `family-pilot` tras merge fast-forward del
  tag aprobado. Nunca auto-deploy desde `develop`.

## 2. Backend API en Render

Servicio: el existente **Vantdomus** (`https://vantdomus.onrender.com`) o uno
nuevo dedicado `vantdomus-family-pilot` (preferible para aislar la demo del
piloto; decide Manuel con ChatGPT).

### 2.1 Source/Build
- **Root Directory:** `apps/api`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Branch:** `family-pilot`
- **Runtime:** Python (`PYTHON_VERSION=3.11.9`).

### 2.2 Disk persistente (obligatorio)
- **Add Disk** → Mount Path `/data` · 1 GB.
- `DB_PATH=/data/vantdomus.db` → la base y sus backups (`/data/backups/`)
  sobreviven a redeploys. **Los backups VACUUM INTO viven en este disco**;
  no hay endpoint de descarga.

### 2.3 Variables de entorno (exactas)

**Borrar:** `DATABASE_URL` (SQLite en este piloto), variables legacy
`NEXT_PUBLIC_*`, cualquier `OPENAI_API_KEY`.

**Cargar:**

| Variable | Valor |
|---|---|
| `APP_ENV` | `demo` (piloto cerrado; `production` exige ClamAV/Redis/SMTP — Sprint D) |
| `DB_PATH` | `/data/vantdomus.db` |
| `JWT_SECRET` | **nuevo**, generado en panel (rotado del histórico) |
| `VANTDOMUS_MFA_SECRET_KEY` | **nuevo**, 32+ chars |
| `VANTDOMUS_PUBLIC_REGISTRATION` | `false` ← **la puerta del piloto** |
| `VANTDOMUS_ALLOWED_HOSTS` | host exacto de Render (ej. `vantdomus-family-pilot.onrender.com`) |
| `CORS_ALLOWED_ORIGINS` | **solo** el dominio exacto de Vercel (ej. `https://vantdomus-family-pilot.vercel.app`) |
| `VANTDOMUS_ALLOW_DEMO_SEED` | `false` (el hogar del piloto se crea 1 vez, sin seed demo) |
| `ASSISTANT_PROVIDER_MODE` | `mock` |
| `ASSISTANT_REAL_PROVIDER_ENABLED` | `false` |
| `ASSISTANT_SHADOW_MODE` | `false` |
| `ASSISTANT_EXTERNAL_CALLS_ALLOWED` | `false` |

Rate limits específicos ya vienen con defaults en código (register 5/h,
login 10/5min, reset 3/h, invitaciones 10/h, backup 3/h); ajustables por
`VANTDOMUS_RL_*_MAX/_WINDOW` solo si ChatGPT lo pide.

## 3. Frontend en Vercel

- Proyecto **nuevo y limpio**: `vantdomus-family-pilot` (no reusar el de la
  demo pública). Root: `apps/web`. Branch: `family-pilot`.
- Env: `API_BASE_URL` (o la variable server-side que use el proxy) → URL del
  Render del piloto. **Nada sensible en `NEXT_PUBLIC_*`.**
- `public/robots.txt` ya bloquea todo (`Disallow: /`); la API además envía
  `X-Robots-Tag: noindex, nofollow` en cada respuesta.
- Ideal: desactivar "Vercel Toolbar/Comments" y previews públicos del proyecto.

## 4. La puerta de entrada (qué cambia con 1a)

- `POST /auth/register` responde **403** con mensaje claro cuando
  `VANTDOMUS_PUBLIC_REGISTRATION=false`. La UI puede leer
  `GET /auth/config` → `{"public_registration": false}` para ocultar el flujo.
- El alta de integrantes es SOLO por **invitación del hogar**: token de un solo
  uso, expirable (1–720 h), hasheado en base, con email obligatorio que debe
  coincidir, y **vínculo opcional a la ficha de persona** (`person_id`): al
  aceptar, `persons.user_id` queda enlazado y esa persona ve "lo suyo".
- **Nota registrada para 1b:** con el registro cerrado, un invitado sin cuenta
  no puede crear una. El flujo de alta real (registro-mediante-token o apertura
  temporal supervisada) se define y autoriza en PILOT-1b.

## 5. Backup y recuperación (RPO ≤ 24 h, RTO ≤ 1 h)

### 5.1 Crear backup (owner, reautenticado)
```
POST /households/{hid}/admin/backup   body: {"password": "<contraseña del owner>"}
```
- Requiere rol **owner** + contraseña correcta (reauth). Rate limit 3/h.
- Ejecuta **`VACUUM INTO`** (snapshot consistente; nunca copia en caliente),
  lo verifica **restaurándolo aislado**: `PRAGMA integrity_check` + conteos
  origen==snapshot, calcula **SHA256**, guarda en `/data/backups/` y retiene
  los **10** más recientes. Auditado con checksum. La respuesta trae solo
  metadata (id, fecha, tamaño, sha256, conteos) — **sin ruta física**.
- `GET /households/{hid}/admin/backup` lista la metadata. **No existe endpoint
  de descarga** (decisión de ChatGPT: el snapshot no sale por el navegador).

### 5.2 Rutina semanal de Manuel
1. Lunes: crear backup vía endpoint (o antes de cada promoción de tag).
2. Verificar `verified: true` e `integrity: "ok"` en la respuesta.
3. Anotar `backup_id` + `sha256` en el registro del piloto.

### 5.3 Restauración (RTO ≤ 1 h)
1. Render → Shell del servicio (o disco montado):
   `ls /data/backups/` → elegir el snapshot más reciente verificado.
2. Parar tráfico (suspender servicio o modo mantenimiento).
3. `sqlite3 /data/backups/<id>.db "PRAGMA integrity_check;"` → debe decir `ok`.
4. `cp /data/vantdomus.db /data/vantdomus.db.pre-restore` (por si acaso).
5. `cp /data/backups/<id>.db /data/vantdomus.db`
6. Reiniciar el servicio → login → verificar hogar, integrantes y módulos.
7. Registrar el incidente (qué se restauró, por qué, sha256 usado).

## 6. Smoke test post-deploy (bloqueante)

1. `GET https://<api>/auth/config` → `{"public_registration": false}` y header
   `X-Robots-Tag: noindex, nofollow`.
2. `POST /auth/register` con email sintético → **403**.
3. Login del owner sintético → 200; navegación básica (hogar, compras, avisos).
4. Crear invitación sintética ligada a persona → aceptar con segundo usuario
   sintético → verifica vínculo → **revocar/limpiar**.
5. Crear backup → `verified: true` → listar.
6. Chat Domi → responde con MockProvider (cero red externa).
7. `https://<web>/robots.txt` → `Disallow: /`.

## 7. Rollback

- **Código:** repointear Render/Vercel al tag anterior (`pilot-YYYY-MM-DD`) y
  redeploy. Las ramas de checkpoint nunca se borran.
- **Datos:** procedimiento §5.3 con el último snapshot verificado.
- **Puerta:** ante cualquier sospecha de acceso indebido → rotar `JWT_SECRET`
  (invalida todas las sesiones), revisar `security_events`, avisar a ChatGPT.

## 8. Qué NO incluye 1a (recordatorio)

- NO incorpora a la familia real (PILOT-1b, con modelo de menores y matriz de
  aislamiento C1–C8).
- NO modelo académico (asignaturas/horarios/pruebas — PILOT-1c) ni vistas (1d)
  ni planificador (1e).
- NO llamadas externas de IA, NO llaves nuevas, NO scheduler/push/email real.
