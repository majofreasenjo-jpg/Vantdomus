# OPS-2 M7.B — Avisos push al teléfono (Web Push / VAPID)

> **Estado:** infra lista y desplegable. El push REAL al teléfono se enciende con
> **2 piezas que pones tú** (Manuel): las llaves VAPID y un Cron Job. Sin ellas,
> los recordatorios siguen avisando **dentro de la app** (M7.A) — nada se rompe.

## Cómo está diseñado (fail-closed en 3 niveles)

El push está **deshabilitado** —y la app cae a avisos in-app— si falta cualquiera de:
1. **Llaves VAPID** en el entorno (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
2. **La librería `pywebpush`** instalada en el backend.
3. Un **perfil operativo** (family-live / staging / prod). En family-pilot nunca se envía.

Y el envío solo ocurre cuando un **Cron Job** llama a `POST /assistant/reminders/tick`
con el secreto correcto. Sin Cron, los vencidos igual se entregan in-app cuando
alguien abre la app.

---

## Paso 1 — Añadir la librería al backend

En `apps/api/requirements.txt`, agrega una línea:

```
pywebpush==1.14.1
```

(Trae `py-vapid` y `http-ece`.) Haz commit + **Manual Deploy** en Render. Si el
build fallara por esta dependencia, quítala: el resto del sistema sigue igual y el
push queda deshabilitado (in-app intacto).

## Paso 2 — Generar las llaves VAPID (una sola vez)

Con `pywebpush` instalado, en un terminal (o en el **Shell** de Render):

```bash
python -c "from py_vapid import Vapid01; v=Vapid01(); v.generate_keys(); import base64; \
print('PUBLIC=', base64.urlsafe_b64encode(v.public_key.public_bytes(\
__import__('cryptography').hazmat.primitives.serialization.Encoding.X962, \
__import__('cryptography').hazmat.primitives.serialization.PublicFormat.UncompressedPoint)).decode().rstrip('=')); \
print('PRIVATE=', base64.urlsafe_b64encode(v.private_key.private_numbers().private_value.to_bytes(32,'big')).decode().rstrip('='))"
```

> Si prefieres, instala `web-push` (Node) y corre `npx web-push generate-vapid-keys`.
> Cualquiera de las dos da un par **PUBLIC / PRIVATE** en base64url. Guarda ambas.

## Paso 3 — Poner las variables de entorno (Render → Environment)

| Variable | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la clave pública base64url del paso 2 |
| `VAPID_PRIVATE_KEY` | la clave privada base64url del paso 2 (**secreta**) |
| `VAPID_SUBJECT` | `mailto:tucorreo@dominio.com` (contacto para el push service) |
| `REMINDER_TICK_SECRET` | una cadena larga y aleatoria (secreto del Cron) |

**Manual Deploy** en Render para aplicarlas. Verifica que el push quedó activo:
la campana de `/recordatorios` mostrará el botón **"Activar avisos"** (solo aparece
si el backend reporta `enabled`).

## Paso 4 — Crear el Cron Job que dispara los avisos

El push llega "aunque la app esté cerrada" porque un Cron llama al backend cada
pocos minutos. En Render → **New → Cron Job** (o cualquier cron externo):

- **Command / Request:** `POST https://vantdomus-family-pilot.onrender.com/assistant/reminders/tick`
- **Header:** `X-Tick-Secret: <el mismo REMINDER_TICK_SECRET>`
- **Schedule:** cada 1–5 minutos (`*/5 * * * *`).

Ejemplo con curl:

```bash
curl -X POST https://vantdomus-family-pilot.onrender.com/assistant/reminders/tick \
  -H "X-Tick-Secret: $REMINDER_TICK_SECRET"
```

Respuesta: `{"ok":true,"delivered":N,"pushed":M,"push_enabled":true}`.

---

## Cómo probarlo (prueba real)

1. En el teléfono/navegador, entra a `/recordatorios` y toca **"Activar avisos"** →
   acepta el permiso del navegador (esto crea la suscripción en el backend).
2. Crea un recordatorio con hora **1–2 minutos en el futuro**.
3. Cierra la app. Cuando el Cron dispare el tick tras la hora, debe llegar la
   **notificación del sistema**; al tocarla, abre `/recordatorios`.

## Seguridad y privacidad

- La clave privada VAPID vive **solo** en el entorno de Render, nunca en el repo.
- El endpoint `tick` no usa sesión: se autentica con `REMINDER_TICK_SECRET`
  (401 si el header no coincide; 503 si no está configurado).
- Un recordatorio **privado** solo hace push al dispositivo de su destinatario
  (misma regla de privacidad que M1/M7.A).
- El service worker es passthrough (sin caché); solo añade los handlers `push` y
  `notificationclick`. No almacena contenido autenticado.
- Suscripciones muertas (404/410) se borran automáticamente en cada envío.

## Rollback

Quita `VAPID_PUBLIC_KEY` (o el Cron Job) → el push se apaga y todo vuelve a
avisos in-app (M7.A). Sin migraciones que revertir; la tabla
`web_push_subscriptions` simplemente deja de usarse.
