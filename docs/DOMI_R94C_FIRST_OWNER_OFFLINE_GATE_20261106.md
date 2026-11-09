# DOMI / VANTDOMUS — R94-C: primer propietario ficticio (2026-11-06)

## Diagnóstico verificado
El primer propietario **ya puede crearse** mediante `apps/api/scripts/bootstrap_admin.py`, y `tests/test_bootstrap_admin.py` prueba creación, ficha vinculada e idempotencia. El registro público debe permanecer cerrado en `APP_ENV=family-pilot`, y el registro de integrantes continúa realizándose exclusivamente mediante invitación.

El comando heredado `bootstrap_admin.py <email> <password>` pasa contraseñas por **argv** y puede actualizar la contraseña de usuarios existentes; se conserva por compatibilidad, pero **no es adecuado como procedimiento del banco de ensayo R94-A**. No eliminar ni sustituir el comando heredado sin una auditoría propia de sus usuarios actuales.

## Implementación R94-C
- Wrapper separado `apps/api/scripts/bootstrap_first_owner_r94c.py`: acceso offline, solo con `APP_ENV=family-pilot`, registro público cerrado y `validate_runtime_security()` íntegro.
- Serializa intentos de creación en el mismo disco con bloqueo local exclusivo, y rechaza una segunda ejecución en vez de sobrescribir o reiniciar contraseñas.
- Requiere correo **exclusivamente ficticio** en `example.invalid`, contraseña fuerte introducida mediante `getpass` en terminal interactivo y confirmación expresa de ensayo sintético.
- Solo admite bases ya migradas en disco persistente fuera del repo y **vacías** respecto a usuarios, hogares, membresías y personas. Si existe información, falla sin intentar resetear a nadie.
- Invoca el constructor de owner ya existente, sin duplicar el modelo de organización, hogar y persona. No abre sockets, ni registra endpoints, ni modifica permisos.
- No imprime la contraseña, correos ni identificadores en el resultado de la CLI. Rechaza argumentos imprevistos sin repetirlos para evitar exposición accidental.
- `tests/test_domi_r94c_first_owner_offline.py`: valida creación, pertenencia, ficha del titular, registro cerrado, denegación en bases existentes, perfil incorrecto, datos no ficticios y parámetros inseguros.
- Security Gate exige el test dedicado y lo incluye también en la suite general.

## Límites, amenazas y bloqueo restante
1. El wrapper incorpora un bloqueo exclusivo local basado en creación atómica del archivo `.r94c-first-owner.lock`, mantenido durante la comprobación de vacío y el bootstrap. Las pruebas incluyen un segundo intento concurrente y comprobación de no reseteo. **No sustituye un aprovisionamiento multioperador ni un sistema de bloqueo distribuido**; el banco debe ejecutarse con el servicio detenido y una única persona autorizada. Si existe un archivo de bloqueo tras una interrupción, se falla cerrado y su eliminación exige revisión humana del estado de la base.
2. El `bootstrap_admin.py` heredado aún soporta reseteo de cuentas por argv. Se recomienda ticket independiente de hardening, previa comprobación de los flujos operativos, no una modificación silenciosa.
3. El CLI R94-C **no fue ejecutado en un PC Windows real**; los tests CI son sintéticos y de proceso.
4. No se han instalado certificados, DNS ni reglas de firewall; no se accede a dispositivos físicos.
5. No hacer merge del PR #5 ni del PR #7 sin autorización expresa. El trabajo R94-C queda separado y sujeto a aprobación posterior.

## Ejecución futura exclusivamente autorizada (NO ejecutar ahora)
Sobre una base de datos de prueba migrada, **vacía**, con variables `family-pilot` y seguridad verificadas:
```text
python scripts/bootstrap_first_owner_r94c.py --email owner@example.invalid --home-name "Hogar ficticio" --confirm-synthetic
```
El comando solicitará la contraseña sin mostrarla. No se deben enviar contraseñas por chat, CI, shell history o argumentos. El ejemplo no corresponde a una cuenta real.

## Scorecard rector
| Eje | Porcentaje | Delta R94-C |
|---|---:|---:|
| D01 Personal | 45% | 0 |
| D02 Familiar | 45% | 0 |
| D03 Desarrollativo | 25% | 0 |
| D04 Federado | 45% | 0 |
| D05 Multidispositivo | 45% | 0 |
| D06 Organizacional | 10% | 0 |
| D07 DOMI–EDIS | 10% | 0 |
| D08 Legado | 10% | 0 |
| D09 Titan/comercial | 25% | 0 |
| D10 MICR/ciencia | 25% | 0 |
| **GLOBAL** | **28,5%** | **0** |

## Siguiente puerta
Revisión de R94-C y R94-B con Claude Code; certificar ambos en CI y preparar banco físico sin activar red. Luego, y solo con autorización del Owner, transporte TLS, DNS, firewall y prueba real PC–teléfono con evidencias F1–F10. Ninguna prueba sintética equivale a la puerta física.
