# OPS-1 — Runbook del perfil operativo `family-live`

> Objetivo del arco OPS-1: dejar el piloto **100% operativo** con las funciones de
> valor **antes** de meter a la familia real: organizador de estudio, lectura de
> documentos (con OCR de fotos), IA real de Domi y conexión familiar.
>
> Rama: `cp1d-ops1-family-live`. **No** toca el deploy congelado (Vercel@698e049 /
> Render@e835bd9). Datos 100% sintéticos hasta que el Owner autorice la familia real.

---

## 1. Qué es `family-live` (vs `family-pilot`)

| | `family-pilot` (sellado) | `family-live` (operativo) |
|---|---|---|
| Blindaje (HTTPS, secretos, invitación, 1 instancia, DB fuera del repo) | ✅ | ✅ (idéntico) |
| IA de Domi | Mock por reglas (jaula, sin red) | **Real (OpenAI) o mock**, tú eliges |
| Organizador de estudio | Plantilla / bloqueado | ✅ Plan a la medida con IA (o plantilla) |
| Documentos + OCR de fotos | Apagado | ✅ Encendido |
| Salud / Finanzas | Cerrado | **Cerrado** (no se abre) |
| Superficie enterprise (CEO/gerencia/forensics/export…) | Cerrado | **Cerrado** (no se abre) |
| Alta | Solo por invitación | Solo por invitación |

`family-live` = mismo blindaje, con las funciones de valor encendidas. Salud,
finanzas y todo lo enterprise **siguen cerrados**.

---

## 2. Encender `family-live` (Render + Vercel)

> Todo se hace en los **paneles** de Render/Vercel. La `OPENAI_API_KEY` la pones
> **tú**; Claude nunca la ve ni la escribe en el código.

### 2.1 Backend (Render) — variables de entorno

Las variables de blindaje ya están puestas del piloto (no las cambies):
`JWT_SECRET`, `VANTDOMUS_MFA_SECRET_KEY(S)`, `VANTDOMUS_ALLOWED_HOSTS`,
`VANTDOMUS_APP_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, `DB_PATH` (disco persistente),
`VANTDOMUS_BACKEND_INSTANCES=1`, `VANTDOMUS_PUBLIC_REGISTRATION=false`.

**Cambia / agrega:**

```
APP_ENV=family-live
```

**Modo A — IA real (Domi entiende y razona; tiene costo por uso):**
```
ASSISTANT_PROVIDER_MODE=openai
ASSISTANT_REAL_PROVIDER_ENABLED=true
ASSISTANT_EXTERNAL_CALLS_ALLOWED=true
OPENAI_API_KEY=<TU_KEY_DE_OPENAI>        ← la pegas tú, en el panel de Render
OPENAI_MODEL=gpt-4.1-mini                ← opcional (default). También soporta visión (OCR).
```

**Modo B — sin IA externa (gratis; Domi por reglas):**
```
ASSISTANT_PROVIDER_MODE=mock             ← o simplemente no pongas los 4 de arriba
```
En Modo B, estudio y documentos igual funcionan con la lógica real (plantilla +
reglas); solo el OCR de fotos y el "razonamiento" de Domi quedan en pausa.

> **Fail-closed:** encender la IA real es **todo-o-nada**. Si pones
> `ASSISTANT_PROVIDER_MODE=openai` sin los dos flags o sin `OPENAI_API_KEY`, el
> backend **no arranca** y te dice exactamente qué falta. Es a propósito.

### 2.2 Frontend (Vercel) — variables de entorno

```
APP_ENV=family-live
```
(Ya tienes `NEXT_PUBLIC_API_BASE` apuntando al backend de Render; no lo cambies.)

### 2.3 Aplicar

1. Guarda las variables en cada panel.
2. **Manual Deploy** del backend en Render (Auto-Deploy sigue desactivado).
3. Redeploy del frontend en Vercel.
4. Verifica el arranque del backend en los logs de Render: debe decir que subió
   sin errores. Si falta un flag/clave, el log te dirá cuál.

### 2.4 Rollback (volver al piloto sellado)

Cambia `APP_ENV` de vuelta a `family-pilot` en ambos paneles, quita los 4 de IA,
y redeploy. Vuelve todo a mock y a puertas cerradas, sin perder datos.

---

## 3. Probar cada función (con familia sintética)

> Usa el **owner sintético** que ya creaste. Todo lo de abajo es probable en el
> navegador; nada se ejecuta solo: Domi **propone** y tú **confirmas**.

### 3.1 Conexión familiar (ya funcionaba)
- Entra al Panel del Hogar `/hogar/<hid>`: integrantes, estados, compras, mural.
- Invita integrantes sintéticos por `/invitacion` (token por fragmento).

### 3.2 Organizador de estudio (real)
- Ve a `/tasks/<hid>` → **Planificador escolar**.
- Sube un aviso escolar (PDF o texto pegado) con una o más fechas de prueba.
- **Modo A (IA):** Domi lee el aviso, detecta materias y fechas, y arma un plan a
  la medida (diagnóstico → práctica → repaso → evaluación), priorizando y evitando
  amontonar pruebas. La respuesta trae `plan_mode: "ai"`.
- **Modo B (sin IA):** genera el plan de plantilla. `plan_mode: "template"`.
- Los pasos quedan como **tareas reales con recordatorios**, editables.

### 3.3 Documentos + OCR (real)
- Abre la **Bandeja de Documentos** y sube un archivo:
  - **PDF con texto:** extrae montos, fechas, comercios y detalle de boleta (reglas).
  - **Foto (jpg/png) — Modo A:** Domi la **transcribe por OCR** y la clasifica; el
    resumen dice *"Foto leída por Domi (OCR). Revisá que el texto sea correcto"*.
  - **Foto — Modo B (sin IA):** queda en *revisión manual* (sin OCR).
- Todo cae en un **candidato pendiente**: tú confirmas antes de archivar.

### 3.4 IA de Domi (real)
- Abre el chat de Domi en el Panel del Hogar.
- Pídele cosas del hogar: *"agrega leche y pan a la lista"*, *"organiza el estudio
  de la prueba del 15/9"*, *"avisa en el mural que el sábado hay almuerzo"*.
- **Modo A:** responde el modelo real (entiende lenguaje natural) y **propone** una
  acción; tú **confirmas/rechazas**.
- **Modo B:** responde el mock por reglas (más rígido, mismo flujo de confirmación).
- Pídele algo sensible (*"registra el remedio de X"*, mover dinero): Domi **no lo
  hace** — lo bloquea y pide confirmación humana en el panel correspondiente.

---

## 4. Qué sigue apagado en `family-live` (a propósito)

- **Salud** (medicación, adherencia, timeline clínico) y **Finanzas** (gastos): 403.
- **Perfil de apoyo** (health_notes, caregiver_notes): 403 (salud-adyacente).
- **Superficie enterprise:** `/ceo`, `/gerencia`, `/forensics`, `/scores`,
  `/coupling`, `/organizations`, `/audio`, `/library/evidence|memory`, export del
  hogar: 403.
- **Registro público** y **OAuth Google/Facebook**: cerrados (alta solo por invitación).

---

## 5. Notas de seguridad (OPS-1)

- El puente de IA conserva **todas** las defensas: timeout, validación estricta de
  esquema, *fallback* a mock ante cualquier fallo, auditoría **sin** el contenido
  del prompt. Domi **solo propone**; nada se ejecuta sin confirmación humana.
- La `OPENAI_API_KEY` vive **solo** en el panel de Render; nunca en el repo, en
  commits, ni en logs.
- Costo: el Modo A factura por uso de OpenAI. Empieza con `gpt-4.1-mini` (barato) y
  observa el gasto en el panel de OpenAI antes de escalar.
- Cuando la demo sintética te convenza, recién ahí se planifica el saneamiento +
  bootstrap real (1b.3) y el onboarding de la familia real. No antes.
