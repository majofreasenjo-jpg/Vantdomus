# DOMI / VANTDOMUS — R94-F · Integración familiar entre procesos (2026-11-09)

## Fuente rectora
Biblia Rectora Canónica V2.1 + Addenda 31–32; 12 órganos y D01–D10 vigentes. Este checkpoint es append-only y **no declara una conexión física PC–teléfono**.

## Línea base
- R94-E PR #9, SHA `6cbe77bace4edae5fc99b0c9698f2ef7908dd14a`: Security Gate [42551225994](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/42551225994) SUCCESS, 6/6 suites.
- Snapshot sintético de FastShip (PR #5), R94-B (PR #7) y R94-C/D (PR #8). Los PR originales siguen separados, sin fusión en R94.
- R94-C/D dispone de bootstrap de primer propietario en family-pilot cerrado y bloqueo local exclusivo del archivo de base.

## Implementación R94-F
`tests/test_domi_r94f_integrated_family_process.py` utiliza **tres procesos Python separados**, una sola SQLite ficticia desechable en directorio de laboratorio fuera de `/tmp` y clientes HTTP TestClient, sin sockets reales:
1. Inicializa schema, primer owner ficticio por R94-C, hogar y ficha; sin registro público.
2. Abre dos sesiones independientes del propietario, registra otro integrante por invitación privada de un solo uso y rechaza su replay.
3. Comprueba memoria familiar compartida y memoria operativa solo para owner, rechazo a invitado y denegación de edición privada por miembro.
4. Revoca una sesión del propietario sin invalidar la otra. El integrante conserva lectura legítima de memoria compartida.
5. Arranca **otro proceso Python nuevo** con la misma SQLite para verificar revocación persistente, acceso legítimo y separación de memoria.
6. Reintenta el bootstrap y comprueba que no pueda reinicializar ni cambiar la cuenta.

El CI ejecuta R94-F expresamente antes de la regresión completa y mantiene suites web, móvil y PostgreSQL aisladas.

## Seguridad y límites de evidencia
- Las claves, tokens e invitaciones son sintéticos; el token de sesión revocado viaja entre subprocesses mediante stdin/captura no mostrada, y no forma parte del informe CI.
- No se ha instalado TLS, DNS, CA, firewall, proxy inverso real ni backend accesible desde un teléfono. `TestClient` NO es transporte de red.
- No se han modificado datos familiares reales, Neon, Render, producción ni servicios de pago.
- El criterio para cierre es GitHub Security Gate SUCCESS sobre SHA final y test específico R94-F explícitamente aprobado. Hasta ese momento, **PENDIENTE**.

## Diez ejes canónicos
| Eje | Acreditado | Delta R94-F |
|---|---:|---:|
| D01 Personal | 45 % | 0 |
| D02 Familiar | 45 % | 0 |
| D03 Desarrollativo | 25 % | 0 |
| D04 Federado | 45 % | 0 |
| D05 Multidispositivo | 45 % | 0 |
| D06 Organizacional | 10 % | 0 |
| D07 DOMI–EDIS | 10 % | 0 |
| D08 Legado | 10 % | 0 |
| D09 Titan / Comercial | 25 % | 0 |
| D10 MICR / Ciencia | 25 % | 0 |
| **GLOBAL** | **28,5 %** | **0** |

## Puertas posteriores
Validación de continuidad en red real PC y móvil físico, certificados de confianza, DNS privado, firewall mínimo, logout/replay y aislamiento entre hogares. Necesita autorizaciones expresas y dispositivos físicos; no se sustituye por pruebas de navegador o TestClient.

## Gobernanza
R94-F permanece draft y aislado de `main` y R94. Los PR #5, #7, #8, #9 y #10 no se fusionan automáticamente. Rollback: descartar rama/prueba R94-F, sin infraestructura que revertir.
