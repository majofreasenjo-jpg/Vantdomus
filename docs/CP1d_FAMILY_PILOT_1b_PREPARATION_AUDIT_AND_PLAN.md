# CP1d-FAMILY-PILOT-1b-PREPARATION — Auditoría, modelo y plan de transición al piloto familiar real

> **Gate:** CP1d-FAMILY-PILOT-1b-PREPARATION (solo auditoría/diseño/documentación).
> **Rama:** `cp1d-family-pilot-1b-preparation` desde `698e049d84148dbb21cb55dc17d07d46da8892b6`.
> **Este documento NO crea código, migraciones ni cambios de configuración.**
> **Convención de anonimato:** los tres hijos se denominan **Hijo A, Hijo B, Hijo C**; los adultos **Adulto 1 (propietario)** y **Adulto 2**. Cero nombres, edades, correos o datos reales.

---

## 1. Estado base (rector)

| Capa | Referencia | Estado |
|---|---|---|
| Frontend producción | Vercel `vantdomus-family-pilot`, rama `family-pilot` @ `698e049` | noindex 3 capas; `/`→`/login` |
| Backend producción | `RENDER_FAMILY_PILOT_SERVICE` @ `e835bd9` | `APP_ENV=family-pilot` fail-closed; registro cerrado; 1 instancia; SQLite en Disk `/data`; IA mock |
| Datos | Solo sintéticos | `SYNTHETIC_HOUSEHOLD_A` (5 fichas) + `SYNTHETIC_HOUSEHOLD_B` (vacío); 3 snapshots verificados |
| Gates cerrados | 1a → deploy sintético (smoke 22/22, restore, rollback) → web hardening | Respaldos canónicos en Drive |

> Los identificadores operativos exactos (service ID, IDs de hogares, nombres de snapshots, correos sintéticos) viven únicamente en el reporte privado de Drive; este documento público usa referencias sanitizadas.

### 1.1 Historia de deployment de ESTA rama documental (precisión de auditoría)

- Vercel generó **previews automáticos** de los commits de esta rama (SHA inicial `8499eb2` y SHA final `5067a96`), ambos **READY con target null**.
- **No hubo deployment productivo ni promoción**: `family-pilot` permanece en `698e049` y Render no fue tocado.
- Formulación canónica: *"Hubo previews automáticos; no hubo promoción ni deploy productivo."*

---

## 2. Inventario técnico auditado (con referencias reales del repositorio)

### 2.1 Matriz de componentes

| COMPONENTE | ESTADO ACTUAL | REUTILIZABLE | CAMBIO NECESARIO | RIESGO | PRUEBA REQUERIDA |
|---|---|---|---|---|---|
| `users` (`apps/api/sqlite_migrations/000_init.sql`: id, email UNIQUE, password_hash, is_active, created_at; + `email_verified_at` en `220_auth_sessions_email_reset.sql`) | Operativo | SÍ | Ninguno para 1b | Bajo | Existentes (22 en `tests/test_family_pilot_access.py`) |
| `persons` (`000_init.sql`: id, household_id, display_name, relation, created_at; + `user_id` en `272_persons_user_link.sql`; + avatar/status en `277_persons_avatar_status.sql`) | Operativo; SIN campos de menor | PARCIAL | **Nuevas columnas/tablas de menor y guardián (1b.1)**; sin FK físicas (SQLite sin FK enforcement aquí) → integridad por aplicación | Medio | Nuevas (matriz §12) |
| `household_memberships` (`000_init.sql`: PK compuesta household+user, role) | Operativo; roles `owner/admin/member/viewer` (`apps/api/app/rbac.py::ROLE_RANK`) | SÍ | Mapeo de roles familiares (§10) sin migración | Bajo | `tests/security/test_tenant_isolation.py::test_household_member_management_is_role_scoped_and_audited` |
| `household_invitations` (`200_household_invitations.sql`: token_hash UNIQUE, expires_at, accepted_at, revoked_at; + `person_id` en `280_invitation_person_link.sql`) | Operativo, single-use, hasheada | SÍ | Ninguno estructural | Bajo | `test_invitation_is_single_use`, `test_invitation_expires`, `test_invitation_create_is_audited_with_person` |
| Alta atómica `POST /auth/register-with-invitation` (`apps/api/app/routes/auth.py::register_with_invitation`) | Operativo y probado ONLINE (smoke F7-F10) | SÍ (núcleo de 1b) | **SÍ requiere cambio backend en 1b.1: los invariantes de menores (§3.6) deben hacerse cumplir SERVER-SIDE dentro de la transacción del endpoint** — el modelo de menores no puede ser una convención de UI; además exponer vía proxy público (1b.2) | **Alto** | 9 tests existentes + suite nueva de invariantes §3.6 (incl. concurrencia) |
| Aceptación autenticada `POST /households/invitations/{token}/accept` (`apps/api/app/routes/households.py::accept_invitation`) | Operativo (cuenta preexistente) | SÍ | Ninguno | Bajo | `test_register_with_invitation_existing_account_gets_clear_path` |
| Sesiones (`220`: `auth_sessions`, jti revocable; `auth.py`: logout, sessions, revoke-others) | Operativo | SÍ | Política de sesión de menores (§4.5, diseño) | Medio | `test_email_verification_password_reset_and_session_revocation` |
| Verificación email + reset (`auth.py`: `_create_email_verification_token`, `request_password_reset`; token durable post-commit) | Operativo; SMTP real NO configurado (entrega falla con evento `email_verification_delivery_failed`) | PARCIAL | **SMTP real u operación sin email saliente es DECISIÓN bloqueante de 1b.3** (§13) | Alto | `test_provider_failure_keeps_account_and_durable_token` |
| MFA (`170_user_mfa.sql`, `180_mfa_recovery_codes.sql`; endpoints en `auth.py`) | Operativo, opcional | SÍ | Política por banda (§4.5, solo diseño) | Bajo | `test_mfa_totp_enforcement_for_login` |
| Auditoría (`090_security_audit.sql::audit_log`, `190_security_events.sql` + cadena `210`) | Operativa; invitaciones/backup auditados con fingerprint, sin PII en claro | SÍ | Auditar eventos de guardián (1b.1) | Bajo | `test_invitation_create_is_audited_with_person` |
| Aislamiento multi-hogar (`apps/api/app/deps.py::require_household_role`, `require_person_in_household`) | Operativo (66/66 `tests/security/`) | SÍ | Ninguno | Bajo | `test_users_cannot_cross_read_or_mutate_other_tenants` + smoke F11 |
| Visibilidad por módulo (#17: `households.meta.module_visibility`, `PATCH /households/{hid}/module-visibility` en `households.py`) | Operativo (finance/health/documents por rol mínimo) | SÍ (base de §10) | Extender diseño a estudio (1c), sin cambio en 1b | Bajo | Suite #17 existente |
| Backup endurecido (`households.py::create_household_backup`, VACUUM INTO + restore aislado) | Operativo online (3 snapshots) | SÍ | Ninguno | Bajo | `test_backup_creates_verified_snapshot_without_paths` |
| Frontend `/login` (`apps/web/app/login/page.tsx` + `actions.ts`: cookies Secure/HttpOnly/Lax vía `lib/runtimeEnv.js`) | Operativo online | SÍ | Copy navbar (§9) | Bajo | `apps/web/tests/cookie-secure.test.mjs` 4/4 |
| `/reset-password`, `/verify-email` (rutas confirmadas en build de Next) | Existen | SÍ | Revisión de copy (§9) | Bajo | Manual + matriz §12 |
| Proxy público (`apps/web/app/api/public/[...path]/route.ts::ALLOWED_PUBLIC_PATHS` = login, email/verify, password/reset/request, password/reset/confirm) | Operativo | PARCIAL | **Agregar `auth/register-with-invitation` a la allowlist (1b.2)** — hoy la UI de invitación NO podría llamar al endpoint | Medio | Test nuevo de allowlist |
| Proxy autenticado (`app/api/proxy/[...path]/route.ts`, CSRF `lib/csrf.ts`) | Operativo | SÍ | Ninguno | Bajo | Existentes |
| Admin de miembros UI (`apps/web/app/settings/[householdId]/members/page.tsx`) | Existe (crea invitaciones) | PARCIAL | Añadir selección de ficha/rol familiar + copy (1b.2) | Medio | Matriz §12 |
| UI de ACEPTACIÓN de invitación | **NO EXISTE** (verificado: cero rutas `app/**/*invit*` de aceptación) | N/A | **Construir `/invitacion` (1b.2)** — pieza central | Alto (UX/seguridad) | Matriz §12 completa |
| Onboarding (`apps/web/app/onboarding/[householdId]/OnboardingWizard.tsx`) | Existe ("invitar familia") | PARCIAL | Alinear con fichas+bandas (1b.2/1b.4) | Bajo | Manual |
| Modelo de menores/guardianes | **NO EXISTE** (ni tablas ni endpoints; verificado en migraciones 000-280) | N/A | **Diseño §4 → migración 1b.1** | Alto | Matriz §12 |
| Endpoints que exponen fichas (`/persons`, `/households/{hid}/panel` en `households.py`, `getPersonDetail` en `apps/web/lib/api.ts`) | Scoped por hogar | SÍ | Filtro por privacy_profile del menor (1b.1 diseño §6) | Medio | Matriz §12 |

**Datos sintéticos existentes (inventario para §7; identificadores exactos solo en el reporte privado de Drive):** 2 users sintéticos (`synthetic-owner@example.invalid`, `synthetic-adult2@example.invalid` como patrón), 2 households (`SYNTHETIC_HOUSEHOLD_A` con 5 persons + 1 invitación consumida; `SYNTHETIC_HOUSEHOLD_B` vacío), 3 memberships, sesiones/tokens de smoke, eventos de auditoría, 3 snapshots (`SNAPSHOT_SYNTHETIC_1/2/3`).

---

## 3. Modelo de menores y guardianes (DISEÑO — no implementar en este gate)

### 3.1 Separación de conceptos (tres entidades)

1. **Persona** (ya existe: `persons`) — la ficha humana: `display_name` (alias permitido), rol familiar (`relation`), preferencias, avatar/estado. **Se agrega en 1b.1:** `age_band` (banda funcional), `privacy_profile`.
2. **Cuenta** (ya existe: `users` + `household_memberships`) — identidad de autenticación: email, password (hash), sesiones, MFA, verificación, rol de hogar. La cuenta se **enlaza** a la ficha vía `persons.user_id` (mecánica ya probada).
3. **Relación de tutela** (NUEVA) — explícita entre menor y guardianes.

### 3.2 Entidades propuestas (1b.1, nombres tentativos)

- **`persons.age_band`** (columna): `child | supervised_minor | supervised_teen | adult` — banda FUNCIONAL, no jurídica; **sin fecha de nacimiento completa en 1b** (diferida, §6).
- **`guardian_relationship`** (tabla): `id, household_id, minor_person_id, guardian_person_id, scope (full|view|recovery), created_at, revoked_at` — un menor puede tener varios guardianes.
- **`guardian_consent`** (tabla): `id, household_id, minor_person_id, consent_type (account_creation|module_access|data_entry), granted_by_user_id, granted_at, revoked_at, notes_sanitized` — el consentimiento lo otorga LA CUENTA de un guardián, auditado.
- **`minor_privacy_profile`** (columna JSON o tabla): qué módulos/campos son visibles PARA el menor y SOBRE el menor (default restrictivo).
- **`account_supervision_policy`** (derivada de `age_band` + `guardian_relationship`, aplicada en endpoints): quién recupera acceso, quién cambia email/password, quién controla MFA.

> Deliberadamente NO se fijan umbrales de edad legales: no existe revisión jurídica documentada (riesgo §13). Las bandas son funcionales y las asigna el guardián.

### 3.3 Bandas funcionales y capacidades

| Capacidad | `child` (niño sin cuenta) | `supervised_minor` (acceso supervisado) | `supervised_teen` (cuenta individual supervisada) | `adult` |
|---|---|---|---|---|
| ¿Puede existir cuenta? | NO (solo ficha) | SÍ, creada por guardián | SÍ, propia | SÍ |
| ¿Quién crea la invitación? | — | Guardián (owner/admin) | Guardián (owner/admin) | Owner/admin |
| ¿Quién define la contraseña? | — (si no puede completar el alta autónomamente, queda como ficha SIN cuenta) | **SIEMPRE el titular** (el guardián JAMÁS ve, elige ni recibe la contraseña) | **El menor, personal** (ídem: guardián jamás la conoce) | La persona |
| ¿Quién acepta condiciones? | — | Guardián (`guardian_consent`) | Guardián + asentimiento del menor | La persona |
| ¿Quién recupera acceso? | — | Guardián | Guardián (el menor NO auto-recupera por email en 1b) | La persona |
| ¿Quién cambia email? | — | Guardián | Guardián | La persona |
| ¿Quién cambia password? | — | El titular; el guardián solo INICIA un reset auditado (el token de reset llega al flujo del titular; el guardián nunca ve ni define la nueva contraseña) | Ídem | La persona |
| ¿MFA? | — | No en 1b | Opcional, gestionado con guardián | Recomendado |
| Rol de hogar al alta | — | `viewer` | `member` | `admin` (Adulto 2) / `owner` (Adulto 1) |
| Revocación/suspensión | — | Guardián revoca sesiones + desactiva (`users.is_active=0`, sesiones jti revocadas) | Ídem | Owner |
| Siempre reservado al adulto | Todo | Config del hogar, miembros, invitaciones, backup, finanzas, salud | Ídem | — |

### 3.4 Los tres hijos — PROPUESTA PENDIENTE DE CONFIRMACIÓN DEL PROPIETARIO

**Arquitectura elegida: opción D (política por banda).** La asignación concreta NO es una decisión ejecutiva de este documento: el sistema soporta cuenta supervisada o solo-ficha sin fricción, y **el propietario debe declarar** cada fila antes de implementar 1b.4. Las decisiones confirmadas se registrarán de forma privada (reporte de Drive), no necesariamente en este repositorio público.

| PERSONA | BANDA FUNCIONAL | CUENTA / SOLO FICHA | GUARDIÁN 1 | GUARDIÁN 2 | SCOPE | CONFIRMADO |
|---|---|---|---|---|---|---|
| Adulto 1 (propietario) | adult | Cuenta (owner) | — | — | — | **PENDIENTE** |
| Adulto 2 | adult | Cuenta (rol por confirmar) | — | — | — | **PENDIENTE** |
| Hijo A | **PENDIENTE** | **PENDIENTE** | PENDIENTE | PENDIENTE | PENDIENTE | **PENDIENTE** |
| Hijo B | **PENDIENTE** | **PENDIENTE** | PENDIENTE | PENDIENTE | PENDIENTE | **PENDIENTE** |
| Hijo C | **PENDIENTE** | **PENDIENTE** | PENDIENTE | PENDIENTE | PENDIENTE | **PENDIENTE** |

- La *sugerencia* técnica (no default ejecutivo) es cuenta individual supervisada donde la banda lo permita — coherente con la intención expresada por el propietario; pero ni "cuenta para los tres", ni "ambos adultos guardianes full", ni "Adulto 2 = admin" quedan establecidos hasta su confirmación explícita, incluida la definición de **quién puede ejecutar recuperación y revocación** por cada menor.
- La clasificación por banda la declara el guardián; **este documento no registra edades reales**.
- La **revisión jurídica chilena sigue siendo bloqueante** antes de crear cuentas de menores (§12).

### 3.6 Invariantes backend obligatorios del alta con menores (a implementar y probar en 1b.1)

El modelo de menores NO es una convención de UI: `register_with_invitation` (o una capa obligatoria invocada por él) debe hacer cumplir, **server-side y dentro de la misma transacción**:

1. `age_band = child` ⇒ alta de cuenta **DENIED** (la ficha no puede recibir usuario).
2. Banda supervisada ⇒ debe existir `guardian_relationship` **activo** (no revocado) para esa ficha.
3. Debe existir `guardian_consent` de tipo `account_creation` **vigente y no revocado**.
4. Guardián, menor, invitación y hogar deben **coincidir** entre sí (cero referencias cruzadas entre hogares).
5. `invitation.person_id` debe coincidir con la ficha objetivo y `person.user_id` debe seguir **NULL** al consumar.
6. El **rol proviene exclusivamente del registro persistido de la invitación**, jamás del payload del cliente.
7. Una invitación **no puede elevar a un menor a `owner` o `admin`** (validación por banda persistida).
8. La banda y la política de supervisión **no se aceptan desde payload no confiable** ni pueden cambiar durante la aceptación.
9. Relaciones de tutela y consentimientos **no pueden pertenecer a otro hogar**.
10. **Cualquier fallo revierte TODO**: cuenta, membresía, vínculo de persona e invitación (patrón atómico ya existente, extendido a los checks nuevos).

Cada invariante tendrá test explícito propio + test de concurrencia (matriz §11).

### 3.7 Sesiones y recuperación de menores (diseño)

- Sesiones de bandas supervisadas: mismas cookies del piloto; expiración estándar (28800s, `ACCESS_TOKEN_EXPIRES_SECONDS`).
- Recuperación: en 1b el auto-reset por email queda **restringido a adultos**. Para un menor, el guardián solo **INICIA** una operación de reset auditada (endpoint de diseño 1b.1 reutilizando `password_reset_tokens`): el token de reset se entrega **al flujo del titular**, quien define su nueva contraseña; **el guardián jamás ve, elige ni recibe la contraseña** ni el token materializado como credencial. Ningún password temporal se comunica por chat, correo ni panel administrativo.

---

## 4. Invitación familiar — experiencia completa (DISEÑO UI, no implementar)

### 4.1 Ruta y custodia estricta del token

- **Ruta recomendada: `/invitacion`** (verificada la estructura real de `apps/web/app/`: sin colisión; convención en español ya usada en `/hogar`, `/compras`, `/avisos`).
- **Transporte del token — OPCIÓN ELEGIDA: A, fragmento de URL** → el enlace es **`/invitacion#t=<token>`**. Justificación: el fragmento **nunca se envía al servidor** (ni al edge/CDN de Vercel, ni a logs del frontend, ni viaja en `Referer`), elimina de raíz la exposición server-side sin crear infraestructura nueva. La opción B (query + intercambio inmediato por cookie efímera `HttpOnly/Secure/SameSite=Strict`) se descarta para 1b: requiere un endpoint adicional y una segunda credencial que ampliaría la superficie sin beneficio neto en single-instance.
- **Custodia obligatoria en el cliente (invariantes de la página):**
  1. El token se **extrae inmediatamente** de `location.hash` al montar.
  2. Se **elimina de la URL con `history.replaceState()`** ANTES de renderizar contenido, cargar recursos adicionales o ejecutar cualquier `fetch`.
  3. **Nunca** se persiste en `localStorage`, `sessionStorage`, analytics ni logs.
  4. **Nunca** aparece en mensajes de error (ni parciales).
  5. Vive **solo en memoria** (estado del componente) durante el submit.
  6. Se **sobrescribe/elimina** del estado al terminar (éxito o error).
- Mitigaciones adicionales ya vigentes: single-use + TTL (1-720h backend) + `Referrer-Policy` restrictiva + noindex global + revocación desde `settings/members`.
- La URL **nunca** incluye password, email en claro, JWT, tokens de sesión ni datos personales.
- **Pruebas futuras de custodia (matriz §11):** URL limpia antes del primer fetch · token ausente del history final · ausente de logs · ausente de storage · ausente de `Referer` · eliminado del estado tras éxito/error.

### 4.2 Flujo (13 pasos, mapeado a piezas reales)

1. Adulto owner/admin abre **Ajustes → Integrantes** (`settings/[householdId]/members/page.tsx`) o el Onboarding; selecciona/crea ficha (`POST /persons`).
2. Elige **rol familiar + banda funcional** (nueva selección UI; banda → rol de hogar según §3.3).
3. Genera invitación (`POST /households/{hid}/invitations` con `email`, `role`, `person_id`) → obtiene enlace `/invitacion?t=…`.
4. Destinatario abre la URL segura.
5. La UI valida el token **sin revelar información innecesaria**: no existe endpoint de "preview" y NO debe crearse uno que filtre; la validación real ocurre al enviar el formulario (anti-enumeración intacta).
6. Pantalla familiar (no técnica): saludo cálido, nombre del HOGAR únicamente si el alta tiene éxito.
7. Formulario: email (debe coincidir con el invitado) + contraseña personal ×2 (política ≥10 + 3 clases, `auth.py::_validate_registration`).
8. Condiciones aplicables: casilla de consentimiento; para bandas supervisadas, texto de supervisión aceptado previamente por el guardián (`guardian_consent`, 1b.1).
9. Alta atómica: `POST /auth/register-with-invitation` **vía proxy público** (requiere agregar la ruta a `ALLOWED_PUBLIC_PATHS` — cambio 1b.2 con test).
10. Vinculación automática a la ficha (`linked_person_id`, ya implementada).
11. Redirección a `/login` con mensaje de éxito (sin autologin en 1b: menos superficie).
12. Auditoría ya existente (`register_with_invitation` en `audit_log` + `security_events`).
13. Reutilización imposible (single-use verificado online).

### 4.3 Estados de pantalla (todos anti-enumeración)

| Estado | Origen backend real | Mensaje familiar (propuesto) |
|---|---|---|
| Alta completada | 200 `{ok:true}` | "¡Bienvenido/a a tu hogar! Ya puedes entrar." |
| Token expirado / revocado / usado / inválido | 400 `Invitación inválida, expirada o ya utilizada` (mensaje único intencional) | "Este enlace ya no está disponible. Pide uno nuevo a quien te invitó." (ÚNICO para los 4 casos) |
| Email no coincidente | 400 (mismo mensaje único) | Ídem anterior (no revela que el token existe) |
| Ficha ya vinculada | 409 | "Esta invitación no pudo completarse. Pide una nueva." |
| Cuenta existente | 409 con guía | "Ya tienes cuenta: inicia sesión y acepta la invitación desde allí." |
| Rate limit | 429 | "Demasiados intentos. Espera unos minutos." |
| Error temporal | 5xx | "No pudimos completarlo ahora. Intenta de nuevo en un momento." |

### 4.4 Piezas técnicas (para 1b.2)

- Componente página `apps/web/app/invitacion/page.tsx` (client) + submit vía `fetch('/api/public/auth/register-with-invitation')` (mismo patrón de `lib/public-api.ts`).
- Cambio mínimo backend-adjacente: **una línea** en `ALLOWED_PUBLIC_PATHS` + test.
- Accesibilidad: labels, foco, errores textuales; móvil: layout de una columna (la base de `/login` ya es responsive).
- Copy adultos vs. menores supervisados: variante de texto según banda (la banda no viaja en la URL; el texto general es válido para ambos: "crea TU contraseña; solo tú la conoces").

---

## 5. Privacidad y minimización de datos (inventario 1b)

### 5.1 Clasificación de campos

| Campo | Clase |
|---|---|
| Nombre visible o alias (`persons.display_name`) | **Imprescindible** (puede ser alias) |
| Email de acceso (solo quien tenga cuenta) | **Imprescindible** |
| Rol familiar (`persons.relation`) | **Imprescindible** |
| Vínculo persona-cuenta (`persons.user_id`) | **Imprescindible** |
| Guardianes (`guardian_relationship`) | **Imprescindible** |
| Banda etaria funcional (`persons.age_band`) | **Imprescindible** |
| Avatar ilustrado / preferencias básicas | Opcional |
| Estado de ánimo/status (U3) | Opcional |
| Fecha de nacimiento completa | **Diferido** |
| RUN/RUT, dirección, teléfono | **Prohibido en 1b** |
| Colegio, curso real, documentos escolares | **Diferido a 1c** (con gate propio) |
| Diagnósticos, medicamentos, datos de salud | **Prohibido en 1b** (gate independiente posterior) |
| Información financiera real | **Prohibido en 1b** |
| Ubicación, fotografías reales, biometría, voz | **Prohibido en 1b** |
| Calendarios externos, cuentas Google/Facebook reales | **Prohibido en 1b** (OAuth es scaffolding no autorizado) |
| Archivos adjuntos personales | **Diferido** |

### 5.2 Retención y eliminación (PROPUESTA PROVISIONAL — no implementar)

> Los plazos (90/30 días) son **provisionales**: no se implementan hasta contar con revisión jurídica, decisión de minimización y confirmación del propietario. Adicionalmente, `audit_log`/`security_events` **no deben preservar nombres, emails ni otros datos de menores tras una eliminación**: solo IDs internos o fingerprints no reversibles (el patrón `_email_fingerprint` ya existente es la referencia).

| Registro | Retención (provisional) | Eliminación |
|---|---|---|
| Invitaciones consumidas/expiradas | 90 días | Purga por job manual autorizado (los token_hash no son reversibles) |
| Sesiones (`auth_sessions`) | Hasta logout/revocación + expiración | Revocación jti inmediata disponible |
| Tokens de verificación/reset usados | 30 días | Purga manual autorizada |
| Auditoría / security_events | Duración del piloto (cadena de hash 210 no se poda) | Solo con gate explícito |
| Cuentas revocadas | `is_active=0` + sesiones revocadas (lógico) | Borrado físico solo con gate + export previo |
| Fichas desvinculadas | Conservan historial del hogar | Borrado con gate |
| Datos de menores | Mínimos de §5.1; exportables por guardián (export por hogar ya existe) | A pedido del guardián, con gate |

---

## 6. Saneamiento sintético (PROCEDIMIENTO DISEÑADO — no ejecutar)

### 6.1 Inventario exacto a sanear (medido en producción-piloto)

users: 2 sintéticos · households: 2 (`SYNTHETIC_HOUSEHOLD_A` con 5 persons, 1 invitación consumida; `SYNTHETIC_HOUSEHOLD_B` vacío) · memberships: 3 · persons: 5 · invitación: 1 · sesiones y tokens de verificación de smoke · eventos de auditoría del smoke (SE CONSERVAN: son evidencia, sin PII real) · 3 snapshots `SNAPSHOT_SYNTHETIC_1/2/3` (SE CONSERVAN por orden vigente) · credenciales sintéticas (QUEMADAS por definición: jamás reutilizar). *(IDs exactos: reporte privado de Drive.)*

### 6.2 Alternativas

- **A. Purga completa del entorno sintético** (users, households, memberships, persons, invitación, sesiones, tokens; auditoría y snapshots se conservan).
- **B. Conservar `Familia Sintetica Piloto` como hogar de regresión aislado** (cuentas desactivadas, sesiones revocadas).

### 6.3 RECOMENDACIÓN: **Opción A (purga completa)**

Justificación: (1) la regresión ya vive en la suite local determinista (230+ tests) y los 3 snapshots permiten **recrear íntegramente** el entorno sintético en local si se necesita; (2) mantener cuentas/hogares sintéticos vivos junto a datos reales de menores agranda superficie de ataque y de confusión operativa (el bug del "hogar equivocado" del smoke lo demostró); (3) una base que contiene SOLO el hogar real simplifica backup, export y auditoría del piloto.

### 6.4 Precondiciones obligatorias antes de ejecutar (gate 1b.3)

1. Snapshot final pre-saneamiento + 2. SHA256 + 3. `integrity_check` + 4. conteos + 5. restauración aislada verificada + 6. plan de rollback POR HITOS (§6.5) + 7. **autorización explícita de ChatGPT** + 8. lista literal de filas a eliminar (por id) presentada ANTES de borrar.

### 6.5 Rollback por hitos (tres snapshots, no uno)

| Hito | Contenido | Uso de rollback |
|---|---|---|
| **SNAPSHOT A** | Estado sintético final, ANTES de purgar | Revierte la purga (solo mientras no exista ningún dato real) |
| **SNAPSHOT B** | Base limpia POST-purga, antes de cualquier dato real | **Rollback operativo normal del bootstrap**: si el alta del propietario falla antes de completarse, se restaura B |
| **SNAPSHOT C** | Estado inmediatamente posterior al alta del propietario real | Fallos posteriores al owner: restaurar C o reparación forward |

- Restaurar **A después de que exista cualquier dato real** implica **borrar esos datos reales**: requiere autorización excepcional explícita que reconozca esa pérdida — jamás es el camino operativo normal.
- Aclaración de la separación: *"Sintéticos y reales no coexisten en la base ACTIVA; los snapshots sintéticos permanecen retenidos y segregados en el Disk"* (la retención de snapshots no viola la separación).

Nunca reutilizar: passwords sintéticas, emails sintéticos, invitaciones antiguas, sesiones, tokens, ni **fichas sintéticas para personas reales** (las fichas reales se crean nuevas).

---

## 7. Bootstrap del primer adulto real (DISEÑO)

### 7.1 Comparación

| Opción | Evaluación |
|---|---|
| A. Comando administrativo que crea la cuenta completa | Funciona (probado con el owner sintético) pero la password nace server-side u obliga a tecleo en Shell; menos limpio |
| **B. Invitación bootstrap single-use generada server-side** | **RECOMENDADA** |
| C. Reemplazar una cuenta sintética | **PROHIBIDA** (mezcla identidades, reutiliza credenciales/fichas; sin justificación extraordinaria) |

### 7.2 Diseño de B (ejecutable solo en 1b.3, con autorización)

Script único en Render Shell (server-side, reproducible, sin secretos en chat/logs):
1. Crea el **hogar real** (vacío) + las 5 **fichas alias** (Adulto 1/2, Hijo A/B/C con `age_band` que declare el guardián después).
2. Inserta una **invitación owner** ligada a la ficha Adulto 1, con email real de acceso del propietario, TTL corto (24h), `token_hash` en base; **el token en claro se muestra UNA vez en el Shell** (pantalla del propietario, no chat).
3. El propietario abre `/invitacion?t=…` y **define su propia contraseña** en la UI (nunca compartida).
4. Alta atómica ya probada → owner real vinculado a su ficha; auditoría completa; reutilización imposible.
5. Rollback: si algo falla antes de aceptar, revocar la invitación (`POST /households/{hid}/invitations/{id}/revoke`) y/o restaurar snapshot pre-bootstrap.
6. **Las otras 4 cuentas** nacen por invitaciones emitidas DESDE la cuenta propietaria vía la UI (1b.4), jamás por Shell.

Garantías: registro público sigue cerrado · password definida por la persona · single-use + expiración · vinculación correcta · auditoría · rollback · cero secretos en logs (token solo en pantalla del Shell, mostrado una vez).

---

## 8. Copy y experiencia familiar (inventario, sin rediseñar)

| UBICACIÓN | TEXTO ACTUAL | TEXTO PROPUESTO | JUSTIFICACIÓN |
|---|---|---|---|
| `apps/web/app/layout.tsx` (navbar brand, visible en /login) | "Planificador de Unidades - Operacion transversal" | "Tu hogar, en calma y conexión" | Eliminar jerga corporativa; frase ya usada en la tarjeta de login |
| `apps/web/app/layout.tsx` (brandTitle) | "VantDomus" | "VantDomus Hogar" | Coherencia con la home Domi |
| `/dashboard` accesos y títulos técnicos residuales (`apps/web/app/dashboard/`) | Varios ("Dashboard") | "Panel del hogar" | Doctrina: "VantDomus no se navega, se conversa" |
| `/reset-password`, `/verify-email` | Copy técnico por revisar | Tono familiar ("Recupera tu acceso") | Consistencia |
| Emails de verificación (`auth.py::_send_email_verification`, asunto/cuerpo) | Texto técnico | Tono familiar | Primera impresión de la familia |
| Prohibidos en todo el copy | — | — | Sin: empresa, organización, unidad, gerencia, CEO, B2B, dashboard técnico, token, setup, tenant |

(El barrido exhaustivo VG+2.1 ya familiarizó dashboard/finanzas/documentos; lo restante es puntual y entra en 1b.2 como commit de copy.)

---

## 9. Matriz de autorización familiar (mínima, para 1b)

Mapeo a mecánica real: roles de `household_memberships` + `module_visibility` (#17) + nueva capa guardián (§3).

**Principio rector de 1b: la capacidad técnica existente NO equivale a autorización del piloto.** Durante TODO PILOT-1b los módulos sensibles quedan cerrados **para TODOS los roles, adultos incluidos** (aunque los endpoints existan de fases previas), y debe existir un **criterio de prueba que confirme que permanecen cerrados**:

| Módulo | Estado en 1b (todos los roles) |
|---|---|
| Salud | **DENIED** |
| Medicamentos | **NOT_IMPLEMENTED** (gate futuro propio) |
| Finanzas reales | **DENIED** |
| Documentos personales | **DENIED** |
| OAuth / conexiones externas | **DENIED** |
| IA externa | **DENIED** (MockProvider) |
| Escuela/estudio real | **NOT_IMPLEMENTED** hasta su gate (1c) |
| Ubicación, voz, fotografía real, adjuntos | **DENIED** |

**Lo ÚNICO utilizable en 1b:** autenticación · fichas mínimas (§5.1) · relaciones familiares/tutela · invitaciones · tareas/actividades básicas (ya auditadas) · compras básicas (sin datos financieros).

Matriz de permisos sobre lo utilizable:

| Permiso | Propietario adulto (owner) | Adulto (rol por confirmar §3.4) | Guardián (relación, no rol) | Adolescente supervisado (member) | Menor acceso limitado (viewer) | Menor sin cuenta |
|---|---|---|---|---|---|---|
| Ver fichas del hogar | SÍ | SÍ | SÍ | SÍ (lista; detalle según privacy_profile) | SÍ (ídem) | — |
| Editar fichas | SÍ | SÍ | Su(s) menor(es) | Solo la propia (campos básicos) | NO | — |
| Miembros e invitaciones | SÍ | Según rol confirmado | NO (salvo que además sea owner/admin) | NO | NO | — |
| Config del hogar / visibilidad módulos | SÍ | Según rol confirmado | NO | NO | NO | — |
| Tareas / actividades básicas | SÍ | SÍ | — | SÍ (propias + hogar) | Ver | — |
| Compras básicas (sin finanzas) | SÍ | SÍ | — | SÍ | Ver | — |
| Auditoría | SÍ | Según rol confirmado | NO | NO | NO | — |
| Backup / eliminación / exportación | SÍ (backup ya exige owner+reauth) | Export según rol; backup NO | NO | NO | NO | — |

---

## 10. Plan de implementación posterior (microcheckpoints)

| MC | Alcance | Archivos/migraciones previstos | Pruebas | Rollback | Gate |
|---|---|---|---|---|---|
| **1b.0** (ESTE) | Auditoría + modelo + plan | Solo `docs/` | N/A | git revert | Auditoría de este doc |
| **1b.1** | Modelo menores/guardianes, SOLO sintéticos: migración `281_minor_guardian_model.sql` (`persons.age_band`, `guardian_relationship`, `guardian_consent`, privacy_profile) + endpoints guardián (crear relación, consentir, **iniciar** reset del menor con token al titular) + **los 10 invariantes de §3.6 hechos cumplir dentro de la transacción de `register_with_invitation`** | `apps/api/sqlite_migrations/281…`, `app/routes/auth.py::register_with_invitation`, router `guardians.py`, `db.py` | Suite nueva `tests/test_minor_guardian_model.py` (un test por invariante §3.6 + concurrencia + matriz §11) + regresión completa | Migración aditiva (columnas/tablas nuevas; sin ALTER destructivo) + snapshot local | Autorización previa + auditoría posterior |
| **1b.2** | UI `/invitacion` + allowlist proxy + mejoras UI members (ficha+banda) + commit de copy §8; SOLO sintéticos | `apps/web/app/invitacion/…`, `app/api/public/[...path]/route.ts` (1 línea), `settings/members`, `layout.tsx` | node tests UI/allowlist + matriz §12 (estados de pantalla) + smoke sintético online | Vercel rollback de deploy | Ídem |
| **1b.3** | Saneamiento sintético (§6, opción A) + bootstrap owner real (§7 opción B) + decisión SMTP | Solo scripts operativos documentados (sin cambios de app salvo decisión SMTP) | Verificación post-purga (conteos=solo hogar real) + alta owner E2E | **Por hitos §6.5: purga→SNAPSHOT A; bootstrap fallido→SNAPSHOT B; post-owner→SNAPSHOT C/forward** | **Autorización explícita de ChatGPT con lista literal de filas** |
| **1b.4** | Alta controlada de los otros 4 integrantes vía UI (Adulto 2 → luego Hijos según banda) | Ninguno (operación) | Checklist por integrante + verificación vínculos/roles/guardianes | Revocar invitación fallida; desactivar cuenta errónea | Autorización + evidencia por alta |
| **1b.5** | Validación familiar, backup post-alta, cierre y respaldo Drive | Ninguno | Smoke familiar + backup verificado | Snapshot | Cierre formal |

Separaciones garantizadas: frontend `698e049`/sucesor auditado · backend `e835bd9`/sucesor auditado · rama `family-pilot` solo avanza por fast-forward autorizado · main sin merge · tras 1b.3, **sintéticos y reales no coexisten en la base ACTIVA** (los snapshots sintéticos permanecen retenidos y segregados en el Disk, §6.5).

---

## 11. Matriz de pruebas futuras (1b.1-1b.4)

| Caso | Tipo | Estado actual |
|---|---|---|
| Invitación válida/ inválida/ expirada/ revocada/ reutilizada/ email mismatch/ cuenta existente/ ficha vinculada/ concurrencia/ rollback atómico | Positiva+negativa | **YA CUBIERTO** (`test_family_pilot_access.py` §5, 9 tests) — se re-ejecuta con la UI encima |
| UI: cada estado de pantalla §4.3 renderiza el mensaje correcto sin filtrar existencia | Negativa/UX | NUEVA (node/Playwright ligero) |
| Allowlist proxy: `register-with-invitation` permitido; rutas no listadas 404 | Seguridad | NUEVA |
| Guardián correcto puede: consentir, INICIAR reset (token al titular), revocar sesiones del menor | Positiva | NUEVA |
| Invariantes §3.6 (uno a uno) + concurrencia del alta con menores | Seguridad | NUEVA |
| Custodia del token de invitación: URL limpia antes del primer fetch; ausente de history/logs/storage/Referer; eliminado tras éxito/error | Seguridad | NUEVA |
| Módulos prohibidos en 1b (salud/finanzas/documentos/OAuth/IA) permanecen cerrados PARA TODOS los roles aunque existan endpoints previos | Seguridad | NUEVA |
| Guardián de OTRO hogar / no-guardián: 403 en todas las anteriores | Abuso | NUEVA |
| Menor (member/viewer) no puede: invitar, cambiar config, ver finanzas/documentos DENIED, tocar auditoría | Abuso | Parcial (#17) → ampliar |
| Menor no puede cambiar su email; sí su password; guardián puede forzar reset | Positiva+negativa | NUEVA |
| Aislamiento entre hogares con roles nuevos | Seguridad | Base 66/66 → ampliar con guardián |
| Recuperación de acceso de adulto (reset E2E) con SMTP decidido | Positiva | Parcial (local) → online en 1b.3 |
| Revocación de cuenta (is_active=0 + sesiones jti) expulsa en la siguiente request | Seguridad | NUEVA |
| Cierre de registro / CORS / CSRF / cookies / rate limits / noindex | Regresión | **YA CUBIERTO** (25+22+10+66) — se mantiene verde |
| Backup/restore/rollback tras migración 281 | Operacional | Repetir ciclo G en sintético |
| Logs sanitizados (sin tokens/PII de menores) | Higiene | Ampliar scan |

---

## 12. Riesgos y deudas (reevaluación)

| Riesgo/deuda | Clasificación |
|---|---|
| **SMTP real no configurado** (verificación/reset por email no entregan) | **BLOQUEANTE antes de datos reales** — decidir en 1b.3: configurar SMTP del proveedor O política sin-email (verificación por guardián/owner) documentada |
| **Recuperación de cuenta de menores** sin diseño implementado | **BLOQUEANTE** → resuelto por diseño §3.5, implementar en 1b.1 |
| **Falta de revisión jurídica específica** (menores, consentimiento, datos personales, jurisdicción chilena) | **BLOQUEANTE formal antes de 1b.4** — bandas funcionales no sustituyen asesoría legal; requiere decisión documentada del Owner |
| Ausencia de CI independiente | Deuda pre-beta (aceptable para una familia) |
| Rate limiter en memoria + 1 instancia + SQLite | Aceptable para una sola familia (fail-closed lo fuerza) |
| Outbox no implementado (post-commit + token durable) | Aceptable para el piloto; deuda pre-beta |
| OAuth Google/Facebook (scaffolding) | Fuera de alcance; DENIED en 1b |
| Exposición pública de la URL estable | Aceptable (doctrina "URL privada ≠ URL secreta": auth + registro cerrado + noindex) |
| Datos de menores | Mitigado por minimización §5 + privacy_profile; revisar en cada gate |
| Eliminación y exportación | Export por hogar existe; retención §5.2; borrado físico con gate |
| Errores de autorización con roles nuevos | Mitigar con matriz §12 y tests de abuso ANTES de 1b.4 |
| Dependencia Render/Vercel | Aceptable; snapshots + runbook de restauración |
| Copy corporativo residual | Deuda 1b.2 (tabla §8) |

---

## 13. Criterios de autorización y cierre — respuestas inequívocas (§16 del gate)

1. **¿Qué integrantes tendrán cuenta?** Con certeza Adulto 1 (owner, bootstrap §7). Adulto 2 e Hijos A/B/C: **PROPUESTA PENDIENTE de confirmación del propietario** (tabla §3.4); la sugerencia técnica es cuenta supervisada donde la banda lo permita.
2. **¿Qué integrantes serán solo ficha?** Cualquier hijo clasificado `child` por su guardián (decisión pendiente §3.4) y toda persona antes de aceptar su invitación.
3. **¿Cómo se representa un menor?** Ficha `persons` + `age_band` + `minor_privacy_profile` + relación `guardian_relationship`; cuenta `users` solo si su banda lo permite, enlazada vía `persons.user_id`.
4. **¿Quién es guardián de quién?** **PROPUESTA PENDIENTE** (tabla §3.4): la sugerencia es ambos adultos como guardianes de los tres hijos, pero relaciones, scope y quién ejecuta recuperación/revocación los confirma el propietario (registro privado).
5. **¿Quién puede recuperar su acceso?** Adultos: auto-reset por email (cuando SMTP esté decidido). Menores: su guardián **INICIA** un reset auditado y el token llega al flujo del titular, que define su nueva contraseña — **el guardián jamás conoce la contraseña** (§3.7).
6. **¿Cómo se obtiene consentimiento?** `guardian_consent` otorgado por la CUENTA de un guardián (creación de cuenta, acceso a módulos, ingreso de datos), auditado y revocable; asentimiento del adolescente en el alta.
7. **¿Qué datos reales mínimos se cargarán?** Solo §5.1 imprescindibles: alias/nombre visible, email de acceso (quien tenga cuenta), rol familiar, vínculo, guardianes, banda funcional.
8. **¿Qué datos quedan prohibidos?** RUN/RUT, dirección, salud/medicamentos, finanzas reales, ubicación, fotos reales, biometría, voz, OAuth real, documentos personales; fecha de nacimiento completa y datos escolares: diferidos.
9. **¿Cómo se crea el primer propietario?** Opción B §7: invitación bootstrap server-side single-use → el propietario define su contraseña en `/invitacion`; registro público jamás se abre.
10. **¿Cómo se purga lo sintético?** Opción A §6: purga completa (lista literal de filas presentada antes), conservando auditoría y snapshots.
11. **¿Cómo se revierte la purga?** Por hitos (§6.5): la purga se revierte con **SNAPSHOT A** (solo mientras no exista dato real); un bootstrap fallido se revierte con **SNAPSHOT B**; tras el owner real, se opera desde **SNAPSHOT C** o reparación forward. Restaurar A con datos reales presentes = pérdida de esos datos y exige autorización excepcional.
12. **¿Cómo se invita al resto?** Desde la cuenta propietaria vía UI (1b.4): Adulto 2 primero; luego cada hijo según banda, con ficha y guardianes ya creados.
13. **¿Qué pruebas deben pasar?** Matriz §11 completa + regresión íntegra (hoy 230+ local, 22 smoke online) verde en cada microcheckpoint.
14. **¿Qué riesgo sigue abierto?** Los 3 bloqueantes de §12: SMTP/entregabilidad, recuperación de menores (diseñada, no implementada) y revisión jurídica; más las deudas pre-beta listadas.
15. **¿Qué gate autoriza la primera cuenta real?** **PILOT-1b.3** (saneamiento + bootstrap), emitido por ChatGPT solo tras cerrar 1b.1 y 1b.2 y resolver los bloqueantes.

---

*Documento generado en el gate CP1d-FAMILY-PILOT-1b-PREPARATION. Sin código, sin migraciones, sin datos reales, sin secretos. Los hijos aparecen exclusivamente como Hijo A/B/C.*
