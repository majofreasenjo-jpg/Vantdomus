# VANTDOMUS-FAMILY-LIVE — CANON DE PRODUCTO

> **Propósito.** Este documento es el **alcance canónico** del producto familiar
> VantDomus. Amplía el foco (que se había reducido a memoria/resumen/voz/chatbot/
> música) a TODO el producto. **Regla de oro:** ninguna capacidad se declara
> completa sin **prueba funcional real** (no basta un botón, animación o stub, ni
> tests de escritorio). Orden de ejecución obligatorio: primero mapa/brechas/
> dependencias/riesgos, luego microcheckpoints de código con test + deploy +
> rollback. Owner = Manuel.

---

## 1. Contrato de Domi (doctrina)

Domi NO es solo un chatbot ni un conjunto de módulos. Cumple **cuatro funciones**:
1. **Conversar y acompañar.**
2. **Recordar y comprender contexto.**
3. **Organizar y proponer acciones.**
4. **Ejecutar herramientas solo con permiso** (confirmación humana).

Cada respuesta de Domi debe declarar internamente su **tipo**:
`conversación · información · sugerencia · propuesta · acción_pendiente_de_confirmación · acción_ejecutada · resultado_de_integración_externa`.

**Invariante:** una conversación casual NUNCA ejecuta acciones (crear tareas,
enviar mensajes, modificar el hogar) por sí sola. Toda acción sensible pasa por
confirmación humana. El texto de documentos y de memorias es **DATA no confiable**,
nunca system-prompt ni instrucción.

## 2. Doctrina de experiencia

**"VantDomus no se navega, se conversa."** Companion-first: pantalla viva, Domi
como presencia central, voz y texto como entrada universal, tarjetas por contexto,
módulos secundarios bajo "Más", sin lenguaje empresarial/técnico. **No** volver a
un dashboard tradicional.

## 3. Modos de Domi (un solo Domi, configuraciones de interacción)

`Clásico · Calma · Senior · Estudio · Protector · Noche`. NO son bots ni
personalidades distintas: son modos adaptativos del mismo Domi (visual +
comportamiento + accesibilidad). Hoy existen solo como **disfraz visual**; falta
conectarlos a comportamiento real (ver mapa).

## 4. Modelo familiar y privacidad

Definir explícito: propietario master · segundo adulto · menores (cuenta
supervisada o solo ficha) · guardianes · permisos · recuperación · revocación ·
baja de integrantes. **La administración técnica del hogar NO implica acceso
universal a memorias privadas.** Distinguir capas: administración técnica ·
tutela de menores · acceso a datos personales · acceso a memorias · invitar ·
eliminar datos. Reglas: una hija no ve memoria privada de otra; un adulto no ve
automáticamente la del otro adulto; el guardián accede solo a lo autorizado del
menor; salud fuera de la memoria general.

## 5. Biblioteca de Domi (6 capas)

1. Memoria personal. 2. Memoria familiar compartida. 3. Conocimiento documental.
4. Historia operativa. 5. Inferencias de Domi (hipótesis). 6. Contexto temporal.

Cada memoria: `subject · author · source · visibility_scope · sensitivity ·
confidence · verified_at · expires_at · supersedes · created_at · updated_at ·
deleted_at` + ver/corregir/confirmar/restringir/exportar/olvidar/trazabilidad.
**Una inferencia NO se vuelve hecho en silencio:** Domi pregunta
("He notado que estudias mejor en sesiones cortas, ¿lo recuerdo?") y solo tras
confirmación se persiste.

## 6. Scopes de visibilidad de memoria

`private_self · guardian_supervised · household_shared · owner_operational ·
temporary_session · document_derived`. La recuperación para IA considera: usuario
actual, ficha, rol, tutela, consentimiento, privacidad, hogar, sensibilidad,
vigencia. **Nunca** enviar al modelo una memoria que el usuario actual no está
autorizado a conocer. Memoria eliminada deja de entrar al contexto.

## 7–19 (resumen de exigencias)

- **Resúmenes:** Mi día / Mi semana / familiar / propietario / guardianes /
  académico / pendientes. Con zona horaria, horario configurable, quiet hours,
  canal (in-app→push→email), reintentos, idempotencia, privacidad por
  destinatario, no enviar vacío, no revelar memoria privada de otro. Separar
  **a demanda** de **programado**.
- **Voz:** micrófono → transcribir → mostrar/corregir → enviar → responder → TTS
  opcional. Detener/interrumpir/velocidad/voz-lenta-Senior/fallback-texto. No
  guardar audio por defecto, cero transcripción en logs, **sin biometría de voz**
  (identidad = sesión activa). Acciones sensibles: confirmar transcripción.
- **Senior/accesibilidad:** letra ampliable, contraste, botones grandes, lectura
  en voz alta, menos densidad, teclado, lector de pantalla, sin infantilización,
  transparencia de que Domi es IA.
- **Estudio:** tareas/pruebas/horarios/asignaturas/material/plan-semanal/técnicas/
  progreso/memoria-de-aprendizaje/privacidad del estudiante + vista distinta
  hija/guardián. Distinguir: declarado · documental · observado · inferido.
- **Documentos:** separar memoria de evidencia; trazabilidad (archivo/versión/
  fecha/autor/origen/página/vigencia/permisos/reemplazo/eliminación) + antivirus
  + anti prompt-injection documental.
- **Música (fases):** MUSIC-0 abrir enlace/app con confirmación · MUSIC-1 OAuth
  individual + control de reproducción · MUSIC-2 listas/preferencias familiares +
  restricciones de menores. Nunca guardar passwords ni enviar tokens OAuth al modelo.
- **Calendarios/integraciones:** capa de conectores (calendario/música/
  notificaciones/almacenamiento). Conexión individual y revocable; toda escritura
  externa requiere confirmación.
- **PWA en operación:** Android/iPhone, manifest, iconos, standalone, SW, sesión,
  logout, actualización, offline/mala conexión, push, revocación de dispositivo.
  No cachear contenido autenticado sensible.
- **LIVE limpio / TEST aislado:** base LIVE sin demo · base TEST sintética ·
  fixtures · preview · regresión. **No borrar los sintéticos del repo de pruebas.**
  Nunca mezclar LIVE y TEST.
- **Derechos de datos:** acceso/corrección/restricción/exportación/eliminación/
  olvido/revocación de consentimiento/cierre de cuenta/cierre de hogar.
- **Master y recuperación:** MFA, sesiones, dispositivos, revocación, recuperación,
  alertas de login, reautenticación para acciones críticas, sucesión administrativa.
- **Operación:** backups/restore/rollback (código y base), migraciones reparables,
  monitoreo, errores, fallback de IA, límites de costo/tokens/audio/OCR, rate
  limits, feature flags, auditoría sin PII.
- **Pruebas familiares:** matriz por dispositivo y cuenta (master/2º adulto/hija
  A/B/C) × (instalación/login/invitación/memoria/privacidad/voz/estudio/resumen/
  actualización/logout). No declarar terminado por pasar tests de escritorio.

---

## MAPA DE ESTADO REAL (2026-07-21, verificado contra el código)

Estados: `IMPLEMENTED · PARTIAL · MOCK · NOT_IMPLEMENTED · BLOCKED`.

| Dominio | Estado | Evidencia / nota |
|---|---|---|
| Contrato de Domi (tipos de respuesta) | **PARTIAL** | propone→confirma real; falta el **tipado explícito** de cada respuesta |
| Doctrina companion-first | **IMPLEMENTED** | /hogar es Domi-céntrico; módulos bajo "Más" |
| Modos de Domi (6) | **MOCK** | solo disfraces visuales (domiAppearance→costume); sin comportamiento/accesibilidad |
| Modelo menores/tutela/consentimiento | **IMPLEMENTED** | 1b.1 (bands, guardian_relationships, guardian_consents) |
| Privacidad de memoria entre adultos/hermanas | **NOT_IMPLEMENTED** | recall solo filtra self/household; no por-persona ni tutela |
| Biblioteca 6 capas + metadatos completos | **PARTIAL** | OPS-2.A: personal+familiar; faltan inferencia/confianza/vigencia/supersedes/trazabilidad/6 scopes |
| Agenda familiar | **PARTIAL** | tasks/unit_functions; sin agenda unificada ni vista semanal |
| Calendario externo (Google/Apple/MS) | **NOT_IMPLEMENTED** | — |
| Tareas | **IMPLEMENTED** | task_items + kanban + /tasks |
| Recordatorios | **PARTIAL/BLOCKED** | se crean; la **entrega** depende de cron externo NO montado |
| Compras | **IMPLEMENTED** | household_shopping + contrato + Domi propone |
| Rutinas | **NOT_IMPLEMENTED** | solo el tipo de memoria routine_pattern |
| Estudio | **PARTIAL** | OPS-1.C planner con IA + tareas; faltan asignaturas/material/semana/progreso |
| Documentos | **PARTIAL** | smart_inbox reglas+PDF; faltan versiones/vigencia/antivirus |
| OCR (foto→texto) | **IMPLEMENTED (family-live)** | OPS-1.D visión; requiere IA real encendida |
| Mensajes directos entre integrantes | **NOT_IMPLEMENTED** | el nodo "Mensajes/3 sin leer" era MOCK; real = solo mural |
| Avisos (mural) | **IMPLEMENTED** | family_board + comentarios/reacciones |
| Resúmenes | **PARTIAL** | modal a demanda (parcial demo); sin digest programado por persona |
| Clima | **IMPLEMENTED** | Open-Meteo vía proxy + geoloc (fix Permissions-Policy) |
| Perfiles | **IMPLEMENTED** | /perfiles avatar/estado |
| Invitaciones | **IMPLEMENTED** | 1b.2 UI + token por fragmento |
| Memoria (motor) | **PARTIAL** | OPS-2.A guarda+inyecta+UI; faltan permisos finos/autoría/inferencia/trazabilidad |
| Música | **NOT_IMPLEMENTED** | ni MUSIC-0 |
| Voz (STT/TTS) | **MOCK** | botón de micrófono falso (notificación, no graba) |
| Notificaciones | **PARTIAL** | in-app/outbox existen; **push NOT_IMPLEMENTED** |
| Modo Senior (accesibilidad) | **MOCK** | disfraz visual; sin letra/contraste/voz-lenta/densidad |
| Master security (MFA/sesiones/revocación) | **PARTIAL** | backend: MFA + list/revoke sessions ✅; falta UI + alertas login + sucesión |
| Continuidad (backup/restore/rollback) | **IMPLEMENTED** | verificado en DEPLOY C-H |
| Fallback de IA (OpenAI cae) | **IMPLEMENTED** | gateway → MockProvider |
| Límites de costo/tokens/audio/OCR | **PARTIAL** | rate limits sí; **cost caps NOT** |
| LIVE limpio / TEST aislado | **NOT_IMPLEMENTED** | hoy UNA base mezcla sintéticos + master real |
| PWA | **PARTIAL** | instalable (iconos/manifest/SW); offline/push/actualización sin probar |
| IA real de Domi | **IMPLEMENTED (family-live)** | OPS-1.B, bajo flags + OPENAI_API_KEY |

---

## BRECHAS CRÍTICAS (prioridad de riesgo)

1. **Privacidad de memoria entre integrantes** (NOT): hoy toda memoria household
   entra al contexto sin filtrar por quién pregunta. **Bloqueante** para invitar a
   la familia real (viola el canon §4/§6).
2. **LIVE limpio / TEST aislado** (NOT): base única mezcla sintético + real.
   **Bloqueante** para "partir limpio" de verdad.
3. **Voz MOCK y modos/Senior MOCK**: botones que aparentan función.
4. **Recordatorios/notificaciones sin entrega real** (sin cron/push).
5. **Contrato de Domi sin tipado explícito** de respuesta.

## DEPENDENCIAS

- Resúmenes programados → cron/scheduler (no montado).
- Push → web-push + VAPID + permisos + revocación de dispositivo.
- Música → OAuth por servicio.
- Calendario → OAuth + conectores.
- Memoria fina/inferencias → ampliar `memory_items` (scopes, confidence,
  supersedes, verified_at) + gate de recuperación por usuario/rol/tutela.

## RIESGOS

- Declarar completo algo MOCK (voz, Senior, mensajes) → ya corregido el criterio.
- Fuga de memoria privada entre adultos/hermanas si se invita a la familia antes
  de cerrar la brecha #1.
- Costo OpenAI sin límite (voz/OCR/chat) sin cost caps.
- Datos reales de la familia como banco de pruebas si LIVE/TEST no se aíslan.

## ORDEN DE EJECUCIÓN (microcheckpoints, cada uno con test + deploy + rollback)

**Fase 0 (gobernanza, este documento):** A. mapa ✅ · B. brechas ✅ ·
C. dependencias ✅ · D. riesgos ✅ · E. microcheckpoints (abajo) · F. plan de
pruebas familiares · G. deploy · H. rollback.

**Microcheckpoints propuestos (orden por riesgo/dependencia):**
- **M1 — Privacidad de memoria** (cierra brecha #1): scopes reales + gate de
  recuperación por usuario/rol/tutela. *Bloqueante para familia real.*
- **M2 — LIVE limpio / TEST aislado** (cierra brecha #2): separar base LIVE
  (Manuel) de sintéticos; fixtures; snapshot+restore antes de limpiar.
- **M3 — Contrato de Domi**: tipar cada respuesta (conversación/…/acción).
- **M4 — Voz real** (reemplaza el MOCK): STT+TTS + confirmación de transcripción.
- **M5 — Modos + Senior reales** (accesibilidad, no disfraz).
- **M6 — Resúmenes** (a demanda → programado con quiet hours + privacidad).
- **M7 — Notificaciones push** (+ entrega de recordatorios).
- **M8 — Biblioteca de memoria completa** (6 capas + inferencias confirmables).
- **M9 — Documentos con trazabilidad** + antivirus.
- **M10 — Música** (MUSIC-0 → 1 → 2). **M11 — Calendarios.**
- **M12 — Matriz de pruebas familiares** (dispositivos reales) antes de invitar.

**Ninguna capacidad se declara COMPLETA sin prueba funcional real.**

---

VANTDOMUS-FAMILY-LIVE-PRODUCT-CANON:
DOCTRINA DE DOMI, MODOS, MODELO FAMILIAR, BIBLIOTECA DE MEMORIA, VOZ, RESÚMENES,
ESTUDIO, DOCUMENTOS, MÚSICA, PWA, PRIVACIDAD, OPERACIÓN Y ACCESIBILIDAD
INCORPORADOS AL ALCANCE CANÓNICO.
NINGUNA CAPACIDAD SERÁ DECLARADA COMPLETA SIN PRUEBA FUNCIONAL REAL.
