# Login social (Google / Facebook) — Guía de activación

> Estado: **scaffolding listo, gateado por configuración**. La UI (botones
> "Continuar con Google / Facebook") y el backend OAuth están implementados,
> pero **inactivos hasta que cargues credenciales reales del proveedor**. Sin
> credenciales, los botones redirigen al login con un mensaje honesto
> ("Login social aún no está configurado"). **No finge sesión.**
>
> ⚠️ Los secretos van SOLO en variables de entorno del panel del proveedor de
> hosting (Render/Vercel) o en `.env` local — **nunca en el repo, ni en el chat,
> ni en capturas**. Si un secreto aparece en alguno de esos lugares, se considera
> quemado y hay que rotarlo.

## Qué quedó implementado

- **Frontend**: botones en `/login` → `${NEXT_PUBLIC_API_BASE}/auth/oauth/{google|facebook}/start`.
- **Backend**: `apps/api/app/routes/auth_oauth.py`
  - `GET /auth/oauth/{provider}/start` — si no hay credenciales, redirige al
    login con mensaje. Si las hay, redirige al proveedor (authorization code) con
    `state` anti-CSRF en cookie httpOnly.
  - `GET /auth/oauth/{provider}/callback` — intercambia el código por token, lee
    el email del usuario, busca/crea el usuario, emite sesión y hace handoff.
- **Handoff web**: `apps/web/app/auth/social-callback/route.ts` fija la cookie
  `vantdomus_access_token` y lleva al inicio.

## Variables de entorno (las cargas tú, no van al repo)

API (backend):
```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
FACEBOOK_OAUTH_CLIENT_ID=...
FACEBOOK_OAUTH_CLIENT_SECRET=...
VANTDOMUS_API_PUBLIC_BASE=https://<tu-api-publica>     # ej. https://api.vantdomus.app
VANTDOMUS_WEB_BASE=https://<tu-web-publica>            # ej. https://vantdomus.app
```
Web (frontend): `NEXT_PUBLIC_API_BASE=https://<tu-api-publica>`

## Pasos en cada proveedor

### Google
1. Google Cloud Console → APIs y servicios → Credenciales → Crear credenciales →
   ID de cliente de OAuth → Aplicación web.
2. **URI de redirección autorizado**: `${VANTDOMUS_API_PUBLIC_BASE}/auth/oauth/google/callback`
3. Copiá Client ID y Client Secret a las variables de entorno (no al repo).
4. Pantalla de consentimiento: scope `email profile openid`.

### Facebook
1. Meta for Developers → Crear app → tipo "Consumer" → producto "Facebook Login".
2. **Valid OAuth Redirect URI**: `${VANTDOMUS_API_PUBLIC_BASE}/auth/oauth/facebook/callback`
3. Copiá App ID y App Secret a las variables de entorno.
4. Permisos: `email`, `public_profile`.

## Antes de confiar en producción (checklist)

- [ ] Probar el flujo completo end-to-end con credenciales reales en staging
      (es código de auth que no se pudo probar localmente sin credenciales).
- [ ] Confirmar que el `redirect_uri` registrado coincide EXACTO con el que
      arma el backend (mismo esquema/host/path).
- [ ] Verificar que el handoff fija la cookie en el dominio correcto (en deploy,
      API y web deberían compartir dominio o usar el proxy `/api/proxy`).
- [ ] Considerar verificación de email del proveedor y vinculación de cuentas
      (mismo email con login email+contraseña y social).
- [ ] Rate limiting en `/start` y `/callback`.

## Límite honesto sobre "estados de redes sociales"

Esto es **login** social (entrar con Google/Facebook). **No** es leer los estados
de WhatsApp/Instagram de tus contactos: las APIs oficiales no lo permiten. Los
"Estados del hogar" de VantDomus son **nativos** (ver `/perfiles/[hid]`).
