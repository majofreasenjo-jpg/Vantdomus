# OPS-2 M9 — Documentos: trazabilidad + antivirus

> **Estado:** el registro de documentos (trazabilidad, versiones, vigencia,
> separación memoria/evidencia, anti-inyección) funciona ya. El **antivirus real**
> es una pieza de infra opcional que enciendes tú, igual que el push de M7.B.

## Qué hace M9 sin configurar nada

- Cada documento subido queda registrado con: **huella sha256**, tamaño, **versión**,
  origen, **vigencia** (opcional), ámbito (familia/privado), autor y fecha.
- **Separación memoria/evidencia:** el documento es evidencia; lo que Domi aprende
  de él vive aparte en la memoria (M8). El documento en sí no "es" un recuerdo.
- **Anti prompt-injection:** el texto de un documento se trata como DATA no
  confiable (`wrap_untrusted`), nunca como instrucciones para el modelo.
- **Versionado con trazabilidad:** subir una versión nueva (botón "Nueva versión")
  crea otra fila enlazada a la anterior; la vieja se retira (deja de servir).
- **Cuarentena fail-closed:** un documento **vencido** o marcado **infectado**
  nunca alimenta a Domi (`servable=false`).
- **Sin antivirus configurado:** los archivos salen marcados `sin escanear`
  (`skipped`) — visibles y usables, pero con la etiqueta honesta.

## Encender el antivirus real (ClamAV)

El escáner es un servicio aparte (ClamAV). Dos piezas:

### 1. Añadir la librería cliente al backend
En `apps/api/requirements.txt`:
```
clamd==1.0.2
```
Commit + **Manual Deploy** en Render. (Si el build fallara, quítala: sin `clamd`
los documentos vuelven a `skipped`, nada se rompe.)

### 2. Levantar un ClamAV accesible y apuntar las env vars
Opciones: un servicio ClamAV en Render/Fly/VPS, o una API de escaneo compatible.
En Render → Environment:

| Variable | Valor |
|---|---|
| `CLAMAV_HOST` | host del daemon ClamAV (ej. `clamav.internal`) |
| `CLAMAV_PORT` | puerto (por defecto `3310`) |

**Manual Deploy.** A partir de ahí, cada documento nuevo se escanea al subirse:
`clean` (✓ Limpio) o `infected` (⚠ queda en cuarentena, no se sirve). El estado
se ve como badge en la lista de documentos, y `GET /assistant/documents` devuelve
`antivirus_enabled: true`.

## Cómo probarlo (prueba real)

1. Sin `CLAMAV_HOST`: sube un PDF → aparece con badge **"sin escanear"** y usable.
2. Con ClamAV configurado: sube un PDF normal → **"✓ Limpio"**. Sube el archivo de
   prueba EICAR (cadena de test antivirus estándar) → **"⚠ Infectado"** y con 🔒
   (no servible).
3. Sube una "Nueva versión" de un documento → la anterior desaparece de la lista
   viva y la cadena de versiones enlaza v2 → v1.

## Seguridad y privacidad

- Un documento **privado** de un integrante no aparece en la lista de otro (misma
  regla que M1/M8; tutela respetada).
- La huella sha256 permite dedupe e integridad sin exponer el contenido.
- El texto de documentos nunca se interpreta como instrucciones para Domi.
- Documento infectado/vencido/eliminado ⇒ jamás entra al contexto de la IA.

## Rollback

Quita `CLAMAV_HOST` → los documentos vuelven a `skipped` (sin escanear). Sin
migraciones que revertir; la tabla `family_documents` sigue operativa.
