# DOMI R94-A — Integración, auditoría del preflight y resolución del enrutamiento interno

Fecha: 2026-11-03 · Rama: `domi-r94-claude-code-handoff-20261031` (continuación del PR #3, sin tercer PR)
Autorización aplicada: **diseño, programación y pruebas locales**. No se instalaron certificados, no se tocó DNS, firewall, puertos, red ni producción.
Estado global canónico: **28,5% — SIN CAMBIO**.

---

## 1. Integración del PR #4 (sin sobrescribir trabajo previo)

PR #4 (`domi-r94a-https-lan-prep-20261102` @ `d1e2a805`) apunta a esta rama, así que
se integró por **merge** y la continuación se presenta aquí. `3b2102c` (diagnóstico
de primera pasada) permanece en la historia; no hubo force-push ni rebase.

### Auditoría de los 5 archivos

| Prueba | Comando | Resultado |
|---|---|---|
| Suite offline del preflight | `node --test tools/r94a/domiR94aLanPreflight.test.mjs` | **7 passed, 0 failed** |
| CLI sobre el plan de ejemplo | `node tools/r94a/domiR94aLanPreflight.mjs tools/r94a/example.plan.json` | `DESIGN_ONLY_VALID`, 7 bloqueos intactos, `canInstall/canDeploy/physicalDeviceCertified = false` |

**Auditoría adversarial** (18 planes maliciosos o mal formados, ejecutada fuera del
repo): **17 rechazados correctamente** — IP literal, IP ofuscada hex, IP decimal,
`http://`, puerto 443 explícito, puerto 8443, credenciales embebidas, wildcard en
allowlist, host extra en allowlist, origen extra en CORS, `intent=LIVE`,
`apiUpstream` a IP de LAN, `apiUpstream` a `0.0.0.0`, `webUpstream` externo, host con
punto final, mayúsculas, campo desconocido inyectado.

**Hallazgo único (severidad BAJA, no bloqueante):** el validador acepta un host
punycode/IDN (`https://xn--dmi-0na.lab.example`), porque encaja en
`[a-z0-9-]+(\.[a-z0-9-]+)+`. Es un nombre DNS legítimo y el plan lo redacta el
propio Owner, así que no hay vector externo. Endurecimiento barato si se quiere:
rechazar etiquetas con prefijo `xn--`, ya que el diseño pide un nombre privado de
split-DNS y el IDN no aporta nada aquí. **No lo apliqué**: es criterio del autor
del preflight, y cambiarlo sin acuerdo sería editar su contrato.

Veredicto: **el preflight es genuinamente fail-closed y su diseño es correcto.**

## 2. Bloqueador `SERVER_TO_API_HOST_ROUTING_UNRESOLVED` — reproducido y resuelto

### Causa raíz (verificada en código, luego reproducida)

1. `apps/web/app/api/proxy/[...path]/route.ts` incluye `"host"` en
   `HOP_BY_HOP_HEADERS`: **elimina** el Host del navegador.
2. Construye la URL upstream con `API_BASE` (`http://127.0.0.1:8001`), de modo que
   `fetch` emite `Host: 127.0.0.1:8001` hacia FastAPI.
3. `apps/api/app/config.py` **prohíbe loopback y wildcard** en
   `VANTDOMUS_ALLOWED_HOSTS` para el perfil familiar, porque esa variable declara la
   superficie pública del navegador.
4. `apps/api/app/main.py` usaba **esa misma variable** para el `TrustedHostMiddleware`
   de la API.

Reproducción (sin red, `TestClient` en memoria):

```
allowed_hosts = ["domi.lab.example.invalid"]
Host: domi.lab.example.invalid  -> 200   (navegador vía proxy TLS)
Host: 127.0.0.1:8001            -> 400   Invalid host header   <-- salto Next->FastAPI
```

**Una sola variable estaba haciendo dos trabajos distintos.** En perfil familiar la
API rechazaba su propio salto de proxy.

### Resolución

`main.py` gana `VANTDOMUS_API_ALLOWED_HOSTS`, que gobierna **solo** qué Host acepta
la API en su escucha loopback. `VANTDOMUS_ALLOWED_HOSTS` y su validación familiar
quedan **intactas**: la superficie pública sigue prohibiendo loopback y wildcard.

- Compatibilidad total: sin la variable nueva, el comportamiento previo no cambia.
- Fail-closed: la lista nueva **rechaza wildcard** aunque la antigua lo tolere fuera
  de producción, porque existe precisamente para ser estrecha.
- TrustedHost, CORS y CSRF se conservan. El proxy ya valida same-origin + token CSRF;
  nada de eso se tocó.

**Invariante declarada explícitamente en el código:** esta allowlist **no sustituye**
al bind loopback ni al firewall. Un header Host no mantiene fuera a un cliente de LAN
si el socket escucha en la LAN. La protección real sigue siendo la dirección de bind.

### Gotcha operativo descubierto por los tests

`TrustedHostMiddleware` compara **solo el hostname y descarta el puerto**. Una entrada
con puerto (`127.0.0.1:8001`) **nunca** coincide y vuelve a bloquear el salto interno.
La configuración correcta es `VANTDOMUS_API_ALLOWED_HOSTS=127.0.0.1`, **sin puerto**.
Queda fijado en un test dedicado para que nadie lo reintroduzca.

### Pruebas

`tests/test_domi_r94a_internal_host_routing.py` — **6 passed**:
regresión del bloqueador · la lista propia admite solo el salto interno (y rechaza
`192.168.1.50:8001` y el nombre público) · no ensancha la superficie pública ·
rechaza wildcard · preserva el comportamiento legado · fija el gotcha del puerto.

Regresión dirigida sobre los 15 archivos de test que tocan `allowed_hosts`/`app.main`
más cold-restart y perfil familiar: **286 passed**.

## 3. Bootstrap privado del primer hogar — ya existe, falta evidencia

No hay que construirlo. Verificado:

- `POST /auth/register-with-invitation` (`apps/api/app/routes/auth.py:410`) es la vía de alta.
- `config.py:162` **exige** `VANTDOMUS_PUBLIC_REGISTRATION=false` en perfil familiar y
  falla el arranque si no lo es. El registro público no puede encenderse por descuido.
- `apps/api/scripts/bootstrap_admin.py` crea de forma idempotente el usuario master,
  su hogar y la ficha de owner.

**Lo que falta no es capacidad sino evidencia**: un procedimiento fechado que
demuestre el alta del primer owner bajo el perfil familiar *sin* registro público, y
la invitación del segundo dispositivo/persona. Queda en el procedimiento §5.

## 4. Cookies, sesión, expiración, revocación y replay — ya existe, falta evidencia

- `auth_sessions` persiste `expires_at` y `revoked_at`; hay listado y revocación de sesiones.
- Cookies: `Secure` se activa por perfil (`SECURE_COOKIE_ENVS` incluye los perfiles
  familiares), más `HttpOnly` y `SameSite`; CSRF por token en el proxy.
- Anti-replay P5: `consumeSessionContinuationReceipt` consume el recibo (uso único);
  las 60 pruebas P5 ya cubren fallo cerrado ante recibo reaparecido o referencias
  incorrectas.

**Pendiente real:** ninguna de estas garantías ha sido observada *bajo la topología
R94-A* (TLS + dos dispositivos). Hasta entonces siguen siendo correctas en runner,
no certificadas en campo.

## 5. Procedimiento de aceptación física (PREPARADO, NO EJECUTADO)

No se ejecuta ningún paso de red. Requiere autorizaciones separadas (CA/DNS/firewall).

**Precondiciones que debe autorizar el Owner por separado:** emisión/instalación de
confianza TLS, resolución privada del nombre, regla de firewall acotada al teléfono.

| # | Paso | Evidencia a capturar | Criterio |
|---|---|---|---|
| F1 | Arrancar backend+web en perfil familiar con `VANTDOMUS_API_ALLOWED_HOSTS=127.0.0.1` | arranque sin `Invalid host header` | el salto interno responde 200 |
| F2 | Bootstrap privado del primer owner | registro público sigue `false` | alta sin abrir registro |
| F3 | PC: login + escribir un recuerdo **ficticio** | hash del recuerdo, nunca el texto real | persiste |
| F4 | Teléfono físico: abrir el origen HTTPS, **autenticarse por sí mismo** | sin advertencia de certificado | sesión propia, no transferida |
| F5 | Teléfono lee lo escrito en F3; escribe otro; PC lo lee tras refresco | capturas con hora | lectura/escritura bidireccional sobre el mismo backend |
| F6 | Reiniciar backend; releer desde ambos | lectura posterior | persistencia real, no caché de navegador |
| F7 | Segundo hogar ficticio e invitado intentan leer | respuesta denegada | sin exposición de memoria |
| F8 | Revocar la sesión del teléfono; reintentar | denegación | revocación efectiva |
| F9 | Reenviar un recibo P5 ya consumido | denegación | anti-replay |
| F10 | Desde otro equipo de la LAN, atacar el puerto 8001 | conexión rechazada | API no expuesta |

**Ningún resultado de esta tabla puede declararse PASS sin ejecución fechada.**
Hoy todos están en **PENDIENTE**.

## 6. Inventario de los seis commits FastShip (ítem 7) — comparados, no fusionados

Rama `cp1d-ops1-family-live`, locales, sin push. Comparados **archivo por archivo**
contra el estado actual de esta rama:

| Commit | Estado aquí | Veredicto |
|---|---|---|
| `64d4546` import de `build_study_steps` | `tasks.py:93` **define la función localmente** | **SUPERSEDED — NO aplicar.** Aplicarlo crearía una colisión de nombre con la definición local. El `NameError` **no existe en esta rama**. |
| `c16f73f` tick auth constante + payload privado | `web_push.py` existe; `hmac.compare_digest` **ausente** | **APLICABLE (seguridad).** Comparación en tiempo constante y contenido genérico en pantalla bloqueada siguen faltando. |
| `6d186d6` service worker same-origin + dedupe | `sameOriginPath` **ausente** en `sw.js` | **APLICABLE (seguridad).** |
| `2c9184a` higiene de suite | los 4 scripts legacy con red/repo foráneo **siguen en `tests/`**; `conftest.py` **sin** anclaje de `sys.path` | **APLICABLE.** Mismo riesgo de contaminación de colección. |
| `9216149` invariante obsoleto del shadow | el test fue renombrado a `..._chat_respects_real_provider_gates`: alguien **ya resolvió** el invariante, pero **sin** la aserción de jaula `family-pilot` | **PARCIALMENTE SUPERSEDED.** Solo aportaría el refuerzo de la jaula. |
| `f3a07e4` rebaseline del PRODUCT_CANON | el canon aquí **no** tiene el rebaseline | **REHACER, no aplicar.** Ese mapa se escribió contra el estado de agosto; aplicarlo tal cual reintroduciría información vieja. |

**Corrección explícita a mi reporte anterior:** dije que el `NameError` del
planificador era «un bug vivo en producción». Eso era cierto en
`cp1d-ops1-family-live`, **no en esta rama**, donde la función está definida
localmente. Lo verifiqué antes de afirmarlo esta vez.

**Hallazgo colateral:** coexisten dos implementaciones de `build_study_steps`
(`routes/tasks.py:93` y `assistant/study_planner.py`). Posible lógica duplicada; lo
señalo para el mantenedor, no lo toco.

No se descartó ni fusionó ninguno de los seis commits.

## 7. Bloqueos restantes

| Bloqueo del preflight | Estado tras esta pasada |
|---|---|
| `SERVER_TO_API_HOST_ROUTING_UNRESOLVED` | **RESUELTO en código y probado** (pendiente de revisión) |
| `INITIAL_INVITATION_BOOTSTRAP_UNRESOLVED` | capacidad **existe**; falta evidencia fechada |
| `CROSS_DEVICE_SESSION_REVOCATION_UNVERIFIED` | capacidad **existe**; falta evidencia bajo topología R94-A |
| `TLS_TRUST_UNVERIFIED` | **requiere autorización del Owner** |
| `PRIVATE_DNS_UNVERIFIED` | **requiere autorización del Owner** |
| `LAN_FIREWALL_UNVERIFIED` | **requiere autorización del Owner** |
| `PHYSICAL_PHONE_E2E_NOT_RUN` | **PENDIENTE** — requiere una persona con el teléfono |

## 8. Diez ejes canónicos — sin cambio

Ninguna puerta recibió evidencia nueva. Un enrutamiento interno corregido y probado
en runner **no es** continuidad entre dispositivos físicos.

| Eje | % | Nueva puerta |
|---|---:|---|
| D01 Personal | 45% | ninguna |
| D02 Familiar | 45% | ninguna |
| D03 Desarrollativo | 25% | ninguna |
| D04 Federado | 45% | ninguna |
| D05 Multidispositivo | 45% | ninguna |
| D06 Organizacional | 10% | ninguna |
| D07 DOMI–EDIS | 10% | ninguna |
| D08 Legado | 10% | ninguna |
| D09 Titan/comercial | 25% | ninguna |
| D10 MICR/ciencia | 25% | ninguna |
| **GLOBAL** | **28,5%** | **sin cambio** |

`real_family_e2e = NOT_VERIFIED` · `production_usable = NOT_CERTIFIED` ·
continuidad física PC↔teléfono = **PENDIENTE, no PASS**.

## 9. Rollback

- Código: revertir el commit de esta pasada. El único cambio de producto es la
  función `_allowed_hosts()` en `apps/api/app/main.py`; sin
  `VANTDOMUS_API_ALLOWED_HOSTS` definida, el comportamiento es idéntico al previo.
- Entorno: no se definió ninguna variable en ninguna máquina.
- Red/infraestructura: **nada que revertir** — no se abrió puerto, no se emitió ni
  instaló certificado, no se tocó DNS ni firewall, no se intervino producción.
