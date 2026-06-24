# Runbook — Deploy demo VantDomus Hogar (Sprint C)

> Objetivo: demo pública controlada de **VantDomus Hogar** bajo cuentas/servicios
> que controla Manuel. Sin runtime real (scheduler/push/email) — eso es Sprint D.
>
> **Commit a deployar**: `22766a2` (o el último de `main`).
> **Tests**: 52/52 verdes. **Gate pre-deploy**: ✅ (main limpio + sincronizado).

## 0. Reglas de seguridad (leer antes)
- **Los secretos finales se generan y cargan DIRECTAMENTE en Render/Vercel/Neon.
  No se comparten por chat, no se imprimen en logs y no se commitean.** Si un
  secreto pasó por un chat, se considera expuesto y debe regenerarse antes de usarse.
- Generá cada secreto vos mismo: usá el botón "Generate" de Render para variables,
  o en tu máquina `python -c "import secrets; print(secrets.token_hex(32))"`, y
  pegá el valor solo en el panel del servicio.
- `DATABASE_URL` (Neon) la pega **Manuel directo en Render**, nunca en un chat.
- No usar credenciales viejas ni el deploy Render antiguo de Codex.
- No subir `.env`. No exponer secretos en variables `NEXT_PUBLIC_*`.
- Hogar para pitch: **limpio** (ver §5). No usar `1b79f92b` (tiene integrantes duplicados de re-seeds viejos).
- `APP_ENV=demo`: relaja los requisitos de infra dura (ClamAV/Redis/SMTP) — válido para demo, NO es producción. En la web, `demo` deja el proxy fail-closed (no activa el token de fallback local).

## 1. Backend API (Render — cuenta de Manuel)
New + → **Web Service** desde `github.com/majofreasenjo-jpg/Vantdomus`.

- **Root Directory**: `apps/api`
- **Runtime**: Python 3 (fijar 3.11 con env `PYTHON_VERSION=3.11.9`)
- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free

### Variables de entorno (valores secretos NO van en este doc)
```
APP_ENV=demo
PYTHON_VERSION=3.11.9
VANTDOMUS_ALLOW_DEMO_SEED=true
VANTDOMUS_AI_FEATURES_ENABLED=false
DATABASE_URL=<Neon, lo pega Manuel directo en Render>                 # nunca por chat
JWT_SECRET=<generá vos, no compartir por chat>                        # token_hex(32) / Generate de Render
VANTDOMUS_MFA_SECRET_KEY=<generá vos, no compartir por chat>          # token_hex(32)
VANTDOMUS_BACKUP_ENCRYPTION_KEY=<generá vos, no compartir por chat>   # token_hex(32)
CORS_ALLOWED_ORIGINS=<URL de Vercel>                                  # se completa tras §2
```
(Opcional) `VANTDOMUS_APP_PUBLIC_URL=<URL Vercel>`. Con `APP_ENV=demo`,
`VANTDOMUS_ALLOWED_HOSTS` puede quedar sin setear (permite el host de Render).

### Posibles problemas
- `psycopg2-binary==2.9.9` debería compilar con wheels en Python 3.11. Si el
  build falla, subir a `2.9.10` o migrar a `psycopg[binary]` 3.x.
- `PyMuPDF==1.24.0`: si pide libs de sistema, es opcional para la demo (solo lo
  usa la Bandeja para PDF y el escaneo de recetas). No bloquea el resto.

### Verificación backend (cuando esté live)
- `GET /health` → `{"ok":true,...}`
- `POST /auth/login` con el owner demo funciona.
- `POST /demo/seed?mode=home` (una vez) puebla la familia.
- `GET /unit_functions`, `GET /library/evidence`, `POST /smart_inbox/analyze` responden.
- CORS permite el origen de Vercel.
- Logs no muestran secretos.

## 2. Frontend Web (Vercel — cuenta de Manuel)
Add New → Project → mismo repo.
- **Root Directory**: `apps/web`
- **Framework**: Next.js (autodetect)
- **Env**:
  - `NEXT_PUBLIC_API_BASE=<URL del backend Render>`
  - `APP_ENV=demo`  (deja el proxy fail-closed)
- No usar el subproyecto viejo ni la API antigua.

### Verificación web
login · dashboard familia · /guia · /biblioteca · /documents · /tasks · /health ·
/finance · Bandeja Inteligente · vista simple · logout.

## 3. Conectar CORS
En Render, completar `CORS_ALLOWED_ORIGINS` con la URL de Vercel → redeploy del backend.

## 4. Demo data limpia (seed una sola vez)
Con ambos vivos y la DB Neon vacía:
1. `POST /demo/seed?mode=home` **una vez** (autenticado como owner demo).
2. Verificar que NO duplica personas: el household debe tener **4 integrantes**
   (Pedro, Camila, Diego, Elena). Si hay duplicados, NO mostrar ese hogar:
   crear uno nuevo limpio.
3. (Opcional, para mostrar visibilidad por rol) `POST /demo/seed_members?household_id=<id>`
   → crea cuentas pedro/camila/diego/elena@vantdomus.local (pass igual al owner).
4. Registrar el `householdId` final del **Demo Hogar Pitch**.

## 5. Smoke test público post-deploy (checklist manual)
1. Abrir el panel web público. 2. Login owner demo. 3. Verificar/crear demo home.
4. Dashboard. 5. Guía Familiar. 6. Hay funciones activas. 7. Documentos familiares.
8. Bandeja: pegar texto de receta. 9. Crea propuesta de medicamento pendiente.
10. Bandeja: texto de boleta. 11. Crea propuesta financiera. 12. Biblioteca.
13. Evidencia/memoria. 14. Salud (empty states o registros). 15. Finanzas (gastos demo).
16. Logout. 17. Login integrante (si hay cuentas). 18. No ve datos ajenos.
19. Probar URL de hogar ajeno → **403**.

## 6. Seguridad antes de entregar la URL
- Sin secretos en el frontend (revisar bundle / variables NEXT_PUBLIC).
- CORS correcto. `APP_ENV=demo`. Logs sin secretos.
- Endpoints protegidos requieren auth. Integrantes no ven hogares ajenos.
- AI features apagadas.

## 7. Rollback
- Web: en Vercel, "Promote" un deployment anterior o desconectar el dominio.
- API: en Render, "Rollback" al deploy previo o suspender el servicio.
- Datos: la DB es Neon nueva/aislada; si se ensucia, re-crear DB o nuevo household limpio.
- El código siempre está en GitHub (`main`), no se pierde nada.

## 8. Resultado (completar tras el deploy)
- Backend URL: `__________`
- Frontend URL: `__________`
- Commit deployado: `22766a2` (o el real)
- Demo Hogar Pitch householdId: `__________`
- Owner demo: `__________`  · Integrantes demo: `__________`
- Fecha de seed: `__________`
- Problemas encontrados: `__________`

## Rehidratación y respaldo post-deploy

Después de cualquier intento de deploy, registrar (sin secretos):
- commit deployado · backend URL pública · frontend URL pública · fecha/hora ·
  resultado del smoke · errores no sensibles · rollback aplicado si hubo.
- Actualizar `VANTDOMUS_REHIDRATACION_ULTIMO_CORTE` en Drive.
- Actualizar `docs/REHYDRATION_INDEX.md` si cambió el estado.
- Refrescar el respaldo ZIP en `G:\Mi unidad\GMATIVE\VantDomus_Backups\<fecha>\`.
- **No registrar secretos** (DATABASE_URL, JWT_SECRET, etc.).

---

## Definition of Done — Deploy C
1. Backend nuevo en cuenta de Manuel. 2. Web en Vercel de Manuel. 3. Web → backend nuevo.
4. DB Neon de Manuel. 5. Demo familia limpia funciona. 6. Login funciona.
7. Dashboard/Guía/Biblioteca/Documentos/Bandeja/Salud/Finanzas cargan.
8. Bandeja v1 funciona con texto/PDF. 9. Smoke de visibilidad pasa en el ambiente desplegado.
10. Sin credenciales expuestas. 11. No depende del Render antiguo. 12. Documentado (§8).

*Después de C aprobado → Sprint D: runtime real (scheduler cron, push Expo, email inbound, métricas).*
