# Runbook — Deploy demo VantDomus Hogar (Sprint C)

> Objetivo: demo pública controlada de **VantDomus Hogar** bajo cuentas/servicios
> que controla Manuel. Sin runtime real (scheduler/push/email) — eso es Sprint D.
>
> **Commit base**: último de `main` (ver `git rev-parse HEAD`).
> **Tests**: 52/52 verdes en el último corte verificado. **Gate pre-deploy** ✅.

## Decisiones consolidadas (auditoría ChatGPT, 2026-06-24)

1. **DB de demo = SQLite + Disk persistente** (no Postgres/Neon en este sprint).
2. **NO usar `/tmp`** para clientes (no persiste entre redeploys).
3. **NO arreglar la rama Postgres** del backend antes del pitch (deuda diferida).
4. **Vercel nuevo limpio** (`vantdomus-hogar-demo`) — **no reusar** `vantdomus-panel` viejo como demo principal.
5. **Domi CSS** (AssistantOrb) alcanza para el pitch — no Lottie/Rive ahora.
6. **Smoke desplegado bloquea** la entrega de la URL pública a clientes.
7. **No pasar a Sprint D** real todavía (scheduler/push/email inbound).

## 0. Reglas de seguridad (leer antes)
- **Los secretos se generan y cargan DIRECTAMENTE en Render/Vercel.** Nunca por chat, log, doc ni commit. Si un secreto aparece accidentalmente, se considera quemado y debe rotarse.
- Generá cada secreto vos: botón **Generate** de Render, o en tu PC `python -c "import secrets; print(secrets.token_hex(32))"`. Pegá el valor solo en el panel del proveedor.
- **NO** cargar `DATABASE_URL` en Render para esta demo (camino SQLite).
- No usar credenciales viejas (Neon `vantdomus-demo` quedó expuesta por captura → rotar/pausar; Neon `vantdomus_neon` del histórico → quemada).
- No subir `.env`. No exponer secretos en `NEXT_PUBLIC_*`.
- `APP_ENV=demo`: relaja requisitos de infra dura (ClamAV/Redis/SMTP), válido para demo, **no producción**. En la web, `demo` deja el proxy fail-closed (sin token de fallback local).
- Hogar pitch: **limpio**, sembrado una sola vez. Documentar `household_id` final.

## 1. Backend API en Render (cuenta de Manuel)

Servicio web existente: **Vantdomus** (`https://vantdomus.onrender.com`).
No crear uno nuevo. Aplicar estos cambios:

### 1.1 Settings → Source/Build
- **Root Directory:** `apps/api` (sin `/` adelante).
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Runtime:** Python (versión via env `PYTHON_VERSION=3.11.9`).
- **Plan:** el actual (post upgrade del usuario).

### 1.2 Settings → Disk (decisión #1 + #2: persistencia obligatoria)
- **Add Disk** → Mount Path: `/data` · Size: `1 GB`.
- Esto hace que `DB_PATH=/data/vantdomus.db` sobreviva a redeploys.

### 1.3 Environment Variables — limpiar y dejar exactamente esto

**Borrar** si están:
- `DATABASE_URL` ← **crítico** (con valor cargado, la app intenta Postgres y crashea; ver §6).
- `VANTDOMUS_ALLOWED_HOSTS` ← si dice `127.0.0.1,localhost`, rechaza el host público.
- Cualquier variable legacy del despliegue antiguo (`NEXT_PUBLIC_ACCESS_TOKEN`, `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID`).

**Dejar/crear** (no secretas, copiar tal cual):
```
APP_ENV=demo
PYTHON_VERSION=3.11.9
DB_PATH=/data/vantdomus.db
VANTDOMUS_ALLOW_DEMO_SEED=true
VANTDOMUS_AI_FEATURES_ENABLED=false
CORS_ALLOWED_ORIGINS=<URL del Vercel nuevo + http://localhost:3000>
```
**Secretas** (valor generado por Manuel directo en el panel):
```
JWT_SECRET
VANTDOMUS_MFA_SECRET_KEY
VANTDOMUS_BACKUP_ENCRYPTION_KEY
```
Save Changes → Render redeploya solo.

### 1.4 Verificación backend (cuando esté Live)
- `GET /health` → `{"ok":true,"service":"vantdomus-core","version":"v0.7.0"}`
- `POST /auth/register` y `/auth/login` con un usuario demo funcionan.
- `POST /demo/seed?mode=home` (una vez, autenticado como owner) puebla la familia limpia.
- `GET /unit_functions`, `GET /library/evidence`, `POST /smart_inbox/analyze` responden.
- CORS permite el origen de Vercel.
- Logs no muestran valores de secretos.

### Posibles problemas y fixes (ya aplicados al código)
- `psycopg2-binary 2.9.10` / `PyMuPDF 1.25.5` (wheels OK para Python 3.11.9) — commit `2b2eaf3`.
- `app/db.py` crea el directorio padre del SQLite si no existe — commit `2bdb6a4`.

## 2. Frontend Web en Vercel (cuenta de Manuel)

**Decisión #4: crear proyecto NUEVO limpio.** No reutilizar `vantdomus-panel` viejo.

### 2.1 Add New → Project
- Repo: `majofreasenjo-jpg/Vantdomus`
- **Name:** `vantdomus-hogar-demo` (queda `vantdomus-hogar-demo.vercel.app`)
- **Framework:** Next.js (autodetect)
- **Root Directory:** `apps/web`
- **Build/Install/Output:** defaults

### 2.2 Environment Variables
```
NEXT_PUBLIC_API_BASE=<URL del backend Render>
APP_ENV=demo
```
- **NO** agregar `NEXT_PUBLIC_ACCESS_TOKEN`.
- **NO** agregar `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID`.
- Nada secreto en `NEXT_PUBLIC_*`.

### 2.3 Deploy
- Deploy desde `main` (último commit).
- Verificar HTTP 200 en `/login`.

### 2.4 Vercel viejo (`vantdomus-panel`)
- **No borrar todavía** (puede usarse para landing aspiracional separada).
- Si se decide retirar, primero eliminar `NEXT_PUBLIC_ACCESS_TOKEN` y `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID` para cortar el modo demo sin login.
- No usarlo como demo principal.

## 3. CORS + cierre
1. En Render, completar `CORS_ALLOWED_ORIGINS=https://vantdomus-hogar-demo.vercel.app,http://localhost:3000` → redeploy backend.
2. Confirmar que el frontend carga `/login` y que la sesión funciona.
3. Disparar el seed limpio (§4).

## 4. Demo data limpia (una sola vez)
1. Crear cuenta owner en `/login`.
2. Crear un household nuevo (ej. "Familia Demo Pitch").
3. `POST /demo/seed?mode=home` autenticado como ese owner.
4. Verificar 4 integrantes (Pedro, Camila, Diego, Elena) — sin duplicados.
5. (Opcional para visibilidad) `POST /demo/seed_members?household_id=<id>` crea cuentas por integrante (pedro@, camila@, diego@, elena@vantdomus.local, todos con el mismo password del demo).
6. **Documentar el `household_id` final** en §8 y en la cápsula de rehidratación.

## 5. Smoke test público post-deploy (21 puntos — gate para entregar URL)
1. Backend `/health` responde. 2. Frontend carga. 3. Login owner funciona.
4. Dashboard familiar carga. 5. Guía Familiar carga. 6. Biblioteca carga.
7. Documentos familiares carga. 8. Bandeja Inteligente carga.
9. Texto de receta genera candidato. 10. Confirmar receta crea medication pendiente.
11. Texto de boleta genera candidato financiero. 12. Finanzas muestra movimiento/propuesta.
13. Salud muestra datos o empty state útil. 14. Integrante demo ve solo lo suyo/compartido.
15. Integrante no accede a household ajeno (403). 16. No se muestran UUIDs innecesarios.
17. No aparece "Dirección Ejecutiva" en family. 18. No aparece "ESG" en family.
19. No aparece "Wealth Guard". 20. No aparece "VantGuide" como copy visible.
21. No hay secrets en logs.

**Si cualquier punto falla, NO entregar la URL pública.**

## 6. Seguridad antes de entregar
- Sin secretos en frontend (revisar bundle / `NEXT_PUBLIC_*`).
- CORS correcto. `APP_ENV=demo`. Logs sin valores de secretos.
- Endpoints protegidos requieren auth. Integrantes no ven hogares ajenos.
- AI features apagadas.
- Vercel viejo: variables legacy eliminadas (si se mantiene activo).
- Neon `vantdomus-demo` (expuesta por captura): rotada/pausada/borrada. No reutilizar en deploy.
- Neon `vantdomus_neon` histórica: quemada, no reutilizar.

## 7. Rollback
- Web: en Vercel "Promote" deployment anterior o desconectar el dominio.
- API: en Render "Rollback" al deploy previo o suspender el servicio.
- Datos: Disk `/data` persiste; para reset limpio borrar el Disk y agregarlo de nuevo, y volver a seedear.
- Código siempre en GitHub `main`, nada se pierde.

## 8. Resultado (completar tras el deploy)
- Backend URL: `__________`
- Frontend URL: `__________`
- Commit deployado: `__________`
- Demo Hogar Pitch `household_id`: `__________`
- Owner demo email: `__________` · Integrantes demo: `__________`
- Fecha de seed: `__________`
- Smoke 21 puntos: `__________`
- Problemas encontrados: `__________`

---

## Rehidratación y respaldo post-deploy

Después de cualquier intento de deploy, registrar (sin secretos):
- commit deployado · backend URL · frontend URL · fecha/hora · smoke result · errores · rollback aplicado si hubo.
- Actualizar `VANTDOMUS_REHIDRATACION_ULTIMO_CORTE` en Drive.
- Actualizar `docs/REHYDRATION_INDEX.md` si cambió el estado.
- Refrescar el respaldo ZIP en `G:\Mi unidad\GMATIVE\VantDomus_Backups\<fecha>\`.
- **No registrar secretos**.

---

## Definition of Done — Sprint C

1. Backend Render live con SQLite + Disk en `/data`. 2. Frontend Vercel **nuevo limpio** apuntando al backend. 3. CORS conecta web ↔ API. 4. Demo familia limpia funciona. 5. Login funciona.
6. Dashboard/Guía/Biblioteca/Documentos/Bandeja/Salud/Finanzas cargan.
7. Bandeja v1 funciona con texto y PDF. 8. Smoke 21 puntos pasa en el ambiente desplegado.
9. Sin credenciales expuestas. 10. No depende del Render/Vercel antiguo. 11. Documentado (§8).
12. Cápsula de continuidad actualizada en Drive.

*Después de C aprobado → VG+2.3 (Panel del Hogar / VantHome Coordination v1) en fases (Muro Familiar + Compras → Actividades → Check-in voluntario).*
