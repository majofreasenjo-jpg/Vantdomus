# DOMI R94 — Diagnóstico PC↔teléfono y comparación de transportes

Fecha: 2026-11-01
Rama: `domi-r94-claude-code-handoff-20261031`
Pasada: **1 de N — diagnóstico y propuesta. No se abrió ningún servicio, puerto ni túnel.**
Estado global canónico: **28,5% — SIN CAMBIO** (no se cerró ninguna puerta).

---

## 1. Qué ya existe (auditado, no reconstruido)

Verificado ejecutando las pruebas reproducibles declaradas en `CLAUDE.md`:

| Capacidad | Evidencia ejecutada hoy | Resultado |
|---|---|---|
| Persistencia backend tras reinicio en frío | `pytest tests/test_domi_r85_cold_restart_family_http.py -q -ra` | **1 passed** |
| Aislamiento entre dos hogares (HTTP) | `pytest tests/test_domi_r72_family_two_households_http.py -q` | **1 passed** |
| Contrato del lanzador local | `pytest tests/test_domi_r86_local_launcher_contract.py -q` | **2 passed** |
| Semántica P5 de continuidad entre superficies | `node --test` sobre 7 suites P5/multi-surface | **60 passed, 0 failed** |

Módulos P5 ya construidos en `apps/web/lib/`: `domiP5CrossDeviceTransport`,
`domiP5CrossDeviceFieldAccess`, `domiP5DeviceMatrix`, `domiP5NetworkTransition`,
`domiP5MobileToDesktopReturn`, `domiP5ContinuityResumeArtifact`,
`domiP5AuthenticatedOwnerScopedRouteBindingContract`, `domiMultiSurfaceContinuity`.

**No hay que reconstruir nada de esto.** La semántica de continuidad (recibo de
continuación, ámbitos autorizados, turnos transferibles, fallo cerrado) está
implementada y probada.

## 2. Qué NO existe (el hueco real de R94)

**Hallazgo 1 — El "transporte cross-device" P5 es una librería de sobres en
proceso, no un transporte de red.**
`tests/domi-p5-cross-device-transport.test.mjs` importa
`createCrossDeviceTransportEnvelope` / `encode` / `decode` y ejecuta *ambos*
extremos dentro de un único proceso Node, sobre
`domiP5SyntheticFixture.mjs`. Prueba — bien — las reglas de ámbito y privacidad
del sobre. **No prueba** que un segundo dispositivo físico exista, ni que haya
un salto de red, ni que el backend familiar participe.

**Hallazgo 2 — El lanzador R86 es loopback por diseño, y correctamente.**
`tools/windows/Start-DOMI-R86-Local.ps1` fija:
```
APP_ENV = local
VANTDOMUS_ALLOWED_HOSTS  = 127.0.0.1,localhost
CORS_ALLOWED_ORIGINS     = http://127.0.0.1:3000,http://localhost:3000
NEXT_PUBLIC_API_BASE     = http://127.0.0.1:8001
```
Un teléfono físico no puede alcanzar el `127.0.0.1` del computador. Esto **no es
un defecto**: es la postura cerrada del canon.

**Hallazgo 3 (el importante) — hoy existen exactamente dos estados coherentes, y
ninguno admite un teléfono físico.**

| | `APP_ENV=local` (lanzador R86) | Perfil familiar (`family-live`/`family-pilot`) |
|---|---|---|
| Cookie de sesión | **no** Secure (`local` ∉ `SECURE_COOKIE_ENVS`) | **Secure obligatoria** |
| Hosts permitidos | loopback explícito | `config.py` **prohíbe loopback y wildcard** |
| URL pública | `http://127.0.0.1:3000` | **exige `https://`** con hostname real incluido en el allowlist |
| ¿Teléfono físico? | **No** — no hay ruta de red | **No** — exige infraestructura HTTPS real |

El atajo intuitivo —*"escucho en 0.0.0.0 y entro desde el teléfono a
`http://192.168.1.x:3000`"*— está bloqueado **tres veces**, y cada bloqueo es
una defensa que el canon exige conservar:
1. `TrustedHostMiddleware` rechaza el Host (no está en el allowlist).
2. CORS rechaza el Origin (no está en la lista exacta).
3. Si además se pasa a perfil familiar para no degradar seguridad, el navegador
   **rechaza la cookie `Secure`**: `http://192.168.x.x` no es *secure context*.
   Solo `127.0.0.1` recibe trato de contexto seguro sin TLS.

**Conclusión: el bloqueo de R94 es de transporte/infraestructura, no de código.**
No hay ningún bug que arreglar para que esto funcione; hay una decisión de
transporte que tomar, y tiene dueño.

## 3. Diagrama de confianza

```
  [PC Windows]                                   [Teléfono físico]
   Next (3000) ─┐                                  navegador
   FastAPI(8001)┘ 127.0.0.1 — frontera actual        │
        │                                            │
        └── SQLite/PG local                          │
                                                     │
   ╔══════════════ HUECO R94 ══════════════╗         │
   ║ no existe canal autenticado y cifrado ║◄────────┘
   ║ entre el teléfono y el backend local  ║
   ╚═══════════════════════════════════════╝

  Identidad ≠ dispositivo ≠ hogar:
   usuario (sesión+CSRF) · dispositivo (no identifica) · hogar (RLS/aislamiento)
  Un dispositivo nuevo NO otorga autoridad: debe autenticarse y quedar
  acotado al hogar. Revocación y expiración deben cortar lecturas futuras.
```

## 4. Opciones de transporte comparadas (ninguna instalada)

| | A · HTTPS en LAN con CA local | B · Red privada superpuesta | C · Túnel público | D · Backend en nube |
|---|---|---|---|---|
| Cómo | cert para un nombre estable; CA raíz instalada en el teléfono; bind a IP de LAN | el teléfono se enrola en una red privada con ACL por dispositivo | se publica el backend tras un hostname público con TLS | se reactiva staging y el teléfono habla con la nube |
| Datos salen de casa | **No** | metadatos al proveedor | **Sí** | **Sí** |
| Terceros | ninguno | proveedor + cuenta | proveedor | Neon/Render |
| Costo | **0** | posible | posible | **facturación** |
| Cookie `Secure` | ✅ (hay TLS) | ✅ | ✅ | ✅ |
| Riesgo principal | instalar una **CA raíz** en el teléfono; API visible a toda la LAN si no se cortafuega | superficie de confianza fuera del hogar | **expone el backend familiar a Internet** | reabre gasto e infra archivada |
| ¿Autorización del Owner? | sí (instalar CA) | **sí, explícita** | **sí, explícita** | **sí, explícita (billing)** |

**Recomendación: A**, por ser la única que mantiene los datos familiares dentro
de casa, sin terceros ni costo. **B** si prefieres no instalar una CA en el
teléfono. **Recomiendo explícitamente NO usar C** para datos familiares: publica
el backend en Internet y contradice la postura cerrada del canon. **D** solo si
decides reabrir facturación, y además no prueba "PC↔teléfono" sino
"teléfono↔nube".

### Requisitos de seguridad que cualquier opción debe satisfacer
Host allowlist exacto (sin wildcard) · CORS por origen exacto · cookies
`Secure`+`SameSite` · CSRF conservado · expiración y **revocación** efectivas ·
aislamiento por hogar (RLS) · regla de firewall acotada al dispositivo · sin
`0.0.0.0` indiscriminado · sin desactivar verificación de certificados ·
cero secretos en cliente, logs o artefactos.

## 5. Lo que requiere acción del Owner (no es código)

1. **Elegir transporte** (A/B/C/D). Sin esto no se puede ensayar nada físico.
2. Si A: autorizar instalar una CA raíz local en el teléfono y fijar un nombre
   de host estable para el PC.
3. Si B/C/D: autorización explícita adicional (tercero / exposición pública /
   facturación), hoy fuera de alcance.
4. **Sostener el teléfono.** Un ensayo físico exige una persona operando el
   dispositivo; no puede completarlo un asistente local.

## 6. Scorecard D01–D10 (sin cambios)

Ninguna puerta canónica recibió evidencia nueva. Las pruebas ejecutadas hoy
**confirman la línea base; no la elevan**.

| Eje | Avance | Nota de esta pasada |
|---|---:|---|
| D01 Personal | 45% | sin cambio |
| D02 Familiar | 45% | persistencia y aislamiento reconfirmados en runner; **no** navegador→teléfono |
| D03 Desarrollativo | 25% | sin cambio |
| D04 Federado | 45% | sin cambio |
| D05 Multidispositivo | 45% | P5 verde **en proceso**; sin evidencia de dispositivo físico |
| D06 Organizacional | 10% | sin cambio |
| D07 DOMI–EDIS | 10% | sin cambio |
| D08 Legado | 10% | sin cambio |
| D09 Titan/comercial | 25% | sin cambio |
| D10 MICR/ciencia | 25% | sin cambio |
| **GLOBAL** | **28,5%** | **sin cambio** |

`real_family_e2e = NOT_VERIFIED` · `production_usable = NOT_CERTIFIED` ·
continuidad PC↔teléfono física = **PENDIENTE, no PASS**.

## 7. Rollback

Esta pasada añade **un único archivo de documentación**. No toca código,
configuración, red ni base de datos. Rollback = eliminar este archivo o
descartar el commit. No hay efectos colaterales.
