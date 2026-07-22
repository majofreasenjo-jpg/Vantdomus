# OPS-2 M2 — LIVE limpio / TEST aislado

> Cierra la brecha bloqueante #2 del canon: hoy la base de producción mezcla el
> hogar real del Owner con hogares sintéticos de prueba. Objetivo: **base LIVE sin
> datos demo**, **datos sintéticos aislados** (para probar el software sin usar a
> la familia real de banco de pruebas), **sin borrados destructivos** y **con
> snapshot + restore**.

## Principio

1. **LIVE** (Render `/data`): SOLO datos reales del Owner y su familia.
2. **TEST**: datos sintéticos **efímeros**, creados por los tests automáticos en
   bases temporales (fixtures). **Nunca** tocan LIVE.
3. **Nunca** mezclar LIVE y TEST. **No** borrar los sintéticos del repo de pruebas.

## Los tests ya están aislados (verificado)

La suite (`tests/conftest.py`) **limpia el entorno** antes de recolectar: fija
`APP_ENV=test`, `VANTDOMUS_SKIP_LOCAL_ENV=1` y borra `DB_PATH`/`DATABASE_URL`
heredados. Cada test crea su base SQLite en un `tmp_path` propio (fixtures). Por
diseño, **ningún test puede escribir en la base LIVE**. Lo blinda
`tests/test_live_test_isolation.py`.

## Enfoque para aislar LIVE: base nueva y limpia (reversible, sin borrar)

En vez de borrar filas sintéticas de la base actual (riesgo de cascada), se
apunta el servicio a una **base LIVE nueva y vacía**, dejando la actual (mezclada)
**intacta como respaldo**. Cero borrados destructivos, 100% reversible.

### Paso 0 — Ver e inspeccionar (Render Shell, solo lectura)

```bash
cd /opt/render/project/src/apps/api
python scripts/db_admin.py inventory   # lista hogares REAL vs SINTÉTICO + conteos
python scripts/db_admin.py snapshot     # copia consistente a /data/backups (respaldo)
```

`inventory` marca sintéticos por correo (`*sintetico*`, `@piloto-sintetico.test`)
o nombre (Sintética/Aislado/Test/Demo/Prueba). Anota los conteos.

### Paso 1 — Nueva base LIVE (Render → Environment)

- Cambia `DB_PATH` a una ruta **nueva**, p. ej.:
  ```
  DB_PATH=/data/vantdomus_live.db
  ```
  (La actual, p. ej. `/data/vantdomus.db`, queda intacta = tu respaldo/restore.)

### Paso 2 — Deploy y re-bootstrap del master

- **Manual Deploy** en Render. Al arrancar, se crea la base nueva vacía (migraciones).
- En el Shell, re-crea tu master en la base limpia:
  ```bash
  cd /opt/render/project/src/apps/api
  python scripts/bootstrap_admin.py "tucorreo@ejemplo.com" "TuClave" "Mi Hogar"
  ```
- Verifica que quedó limpia:
  ```bash
  python scripts/db_admin.py inventory   # debe mostrar SOLO tu hogar (1 real, 0 sintéticos)
  ```

### Paso 3 — Entrar y confirmar

- Recarga la web (Ctrl+Shift+R), entra con tu master. LIVE ahora solo tiene lo tuyo.

## Restore / rollback

- **Volver a la base anterior:** cambia `DB_PATH` de vuelta a la ruta original
  (`/data/vantdomus.db`) y Manual Deploy. Recuperas todo lo de antes (incluidos
  los sintéticos) tal cual.
- **Restaurar un snapshot:** detén el servicio y copia el archivo de
  `/data/backups/vantdomus-<ts>.db` sobre la ruta de `DB_PATH`.

## Verificación (definición de "hecho")

- `inventory` en LIVE: **0 hogares sintéticos**, solo el/los real(es).
- Sin nombres/correos demo en la base LIVE.
- La base anterior sigue disponible como respaldo.
- Los tests siguen verdes (usan fixtures, no LIVE).

> Nada se declara COMPLETO sin prueba real: la limpieza se confirma con `inventory`,
> no "a ojo".
