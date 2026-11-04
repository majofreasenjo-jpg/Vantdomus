# DOMI R94-A — Preparación de HTTPS privado en LAN (DISEÑO, NO INSTALACIÓN)
Corte: 2026-11-02 · Rama: `domi-r94a-https-lan-prep-20261102` · Base: `f7e5731e` del PR draft #3 de R94.

## Autorización exacta
El Owner autoriza: diseño, programación de preflight **offline**, tests sintéticos y revisión de código con Claude Code. **NO** autoriza instalación de CA, modificación de DNS o firewall, exposición de puertos, túneles, compras, despliegue ni utilización de datos familiares reales. Ningún archivo de esta propuesta instala software, abre sockets o crea certificados. El fixture `domi.lab.example.invalid` es deliberadamente ficticio y **no debe resolverse ni usarse como dirección operativa**.

## Resultado verificable a obtener ahora
`node --test tools/r94a/domiR94aLanPreflight.test.mjs`
`node tools/r94a/domiR94aLanPreflight.mjs tools/r94a/example.plan.json`

Un informe `DESIGN_ONLY_VALID` **solo** demuestra consistencia de hipótesis del diseño. Los campos `canInstall`, `canDeploy` y `physicalDeviceCertified` permanecen `false`. Los siete bloqueos no se convierten automáticamente en aprobados.

## Topología candidata A (no implementada)

```text
[TELÉFONO REAL, SIN PROVISIONAR]           [PC WINDOWS, SIN CONFIGURAR]
   navegador HTTPS                            firewall de entrada restringido
   identidad y sesión propia                    |
              |                                  |
       LAN privada — HTTPS (certificado aún NO elegido)
              |                                  |
       [futuro proxy TLS privado]  (UNICO ingreso LAN)
              |
       [Next.js 127.0.0.1:3000]  servidor de aplicación
              |
        server-side proxy Next → FastAPI (ruta interna aún NO verificada)
              |
       [FastAPI 127.0.0.1:8001]     NO accesible directamente en LAN
              |
       [SQLite de ensayo persistente fuera del repo, o PG futuro autorizado]
```

No utilizar `--host 0.0.0.0` como solución rápida para FastAPI. No abrir acceso WAN. No instalar un túnel de terceros. **Un proxy TLS invertido debe hacer entrar al teléfono por Next.js, no por la API**. Es necesario comprobar que el proxy preserve de forma segura el host original y que el backend use una identidad host interna explícita, no un bypass de TrustedHost.

## Contrato de seguridad propuesto

1. **Entrada TLS**: un único origen HTTPS con hostname válido y resolución privada; cert con SAN para ese hostname; certificados pendientes. Antes de una CA raíz local, evaluar dominio administrado y desafío DNS-01 con split DNS; no requiere exponer un puerto web público, pero la viabilidad, titularidad y renovación automática están pendientes de verificación. Si se elige CA local, instalar confianza solo tras autorización y valorar dispositivo de pruebas: una CA raíz amplía la confianza más allá de DOMI.
2. **Sesión**: perfiles `family-pilot`, cookies `Secure`, `HttpOnly` cuando corresponde, `SameSite`, CSRF obligatorio, rate limits y expiración/revocación. La cuenta no se transfiere por P5; cada dispositivo debe autenticarse de manera legítima.
3. **Autoridad**: Host allowlist de nombre exacto, CORS por origen exacto, sin wildcard, sin `http://192.168.x.x` para el navegador. En Next.js verificar Server Actions bajo proxy con validación de Origin y Host/Forwarded-Host (sin comodines ni confianza ciega en encabezados remitidos por el navegador).
4. **Backend**: `apps/api/app/config.py` rechaza loopback en el allowlist del perfil familiar. `apps/web/lib/public-api.ts` utiliza API_BASE para acceso desde el servidor; `/api/public` y `/api/proxy` hacen solicitudes server-side. **Bloqueador técnico real**: proponer host virtual privado de upstream que resuelva a 127.0.0.1, con Host validado explícitamente, o una solución equivalente rigurosamente probada. Nunca permitir cualquier Host, ni usar la IP LAN para abrir FastAPI. Resolver confianza TLS del frontend y encaminamiento interno antes de afirmar funcionalidad.
5. **Alta inicial**: el perfil familiar exige `VANTDOMUS_PUBLIC_REGISTRATION=false`; R87 `local-first-run` solo es válido en dev local y no puede simplemente habilitarse en `family-pilot`. Ya existe alta **por invitación** en `/auth/register-with-invitation`. Falta documentar/probar el bootstrap **privado** del primer owner sin encender registro público. No inventar cuentas ni secretos.
6. **Persistencia**: disco fuera del repositorio y de `/tmp`, con limpieza de datos sintéticos, backups/control de acceso según política aplicable; no intervenir Neon/Render.
7. **Límites**: el ensayo A demuestra únicamente continuidad en una LAN concreta. No demuestra continuidad fuera de casa, conexión simultánea en redes distintas, TV, auto, identidad longitudinal completa ni capacidades constitutivas.

## Matriz de amenazas y verificaciones pendientes

| Riesgo | Contramedida de diseño | Evidencia requerida |
|---|---|---|
| Interceptación en red | TLS autenticado con hostname y cadena válida | inspección de certificado en PC y móvil, sin advertencias |
| Suplantación de origen / CSRF | origen exacto + token CSRF + validación proxy | solicitudes ajenas 403; login legítimo funciona |
| Exposición accidental de FastAPI | loopback, proxy único, firewall estrecho | intento externo a puerto API denegado |
| Reutilización de recibo P5 | nonce/expiración, enlace a sesión y receptor autorizado | replay denegado, sin transferencia de autoridad |
| Lectura entre hogares | autorización backend, pruebas RLS/tenant | dos usuarios/hogares ficticios, segundo sin acceso |
| Robo o expiración de sesión | logout, revocación efectiva, cookies protegidas | sesión revocada no puede leer, incluso tras reinicio |
| Persistencia aparente en navegador | almacenamiento servidor + nuevas sesiones | lectura después de reinicio de backend |
| Certificado de confianza demasiado amplia | DNS-01/split DNS preferible si viable; si CA local, alcance y retirada | autorización Owner y procedimiento de revocación |
| Primer usuario sin autorización | bootstrap privado, token de invitación | registro público permanece cerrado |
| Datos familiares en repositorio público | solo fixtures ficticios, secret scan | repo/CI sin secretos ni PII |

## Criterios de aceptación de una fase física posterior (NO AUTORIZADA)
- PC Windows físico y teléfono real, con lectura y escritura bidireccionales sobre **el mismo estado backend**.
- Autenticación independiente por dispositivo; relectura tras cierre/reapertura y reinicio servidor.
- Invitado, otro hogar, sesión revocada y replay sin autorización no consiguen acceso.
- TLS y host correctos en ambos dispositivos; API no expuesta en la LAN.
- Trazas con hashes/estados, nunca contraseñas, cookies o recuerdos reales.
- Evidencia de prueba manual fechada firmada por Owner; aprobar por separado cualquier instalación CA, DNS o firewall.

## Colaboración con Claude Code
La rama del agente `domi-r94-claude-code-handoff-20261031` **no se modifica** aquí porque Claude informó de un commit local `3b2102c` sin push y seis commits FastShip en otra rama. Este paquete se prepara sobre una rama independiente y se somete a revisión por PR hacia esa rama. Claude puede conservar su trabajo y tomar o integrar los commits tras revisar conflictos; no force-push, no merge automático.

Requerir a Claude: confirmar validez/ausencia de errores en las pruebas offline, estudiar cómo hace el bootstrap privado del primer owner y la ruta Next→FastAPI con TrustedHost, y diseñar pruebas de certificado sin ejecutarlas. No declarar PASS físicos.

## Diez ejes del documento rector V2.1 + Addenda 31–32
| Eje | % conservador | Nueva puerta R94-A |
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

**Rollback**: revertir exclusivamente los commits de `domi-r94a-https-lan-prep-20261102`. No hay puertos, CA, firewall, infraestructura, datos o configuraciones activas que revertir.
