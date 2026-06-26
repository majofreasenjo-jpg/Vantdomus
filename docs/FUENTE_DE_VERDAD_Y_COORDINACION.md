# Fuente de verdad y coordinación de agentes (VantDomus)

> Creado para resolver el enredo generado por trabajo en paralelo de **Google
> Antigravity** sobre una copia distinta del proyecto.

## Fuente de verdad ÚNICA
- Repo: **`github.com/majofreasenjo-jpg/Vantdomus`**, rama **`main`**.
- Estado canónico al 2026-06-26: commit **`b26309c`** (y siguientes en `main`).
- Todo lo válido del proyecto vive aquí. **No hay otra rama/repo canónico.**

## Sobre los commits del walkthrough de Antigravity (`3bd84c0`, `eabddf7`)
- **NO existen en este repo** (ni local ni remoto; verificado con `git fetch` +
  `git cat-file`). Fueron hechos en una **copia separada** de Antigravity que
  nunca empujó aquí.
- Describen la **misma Opción B (Lottie)** que ya está implementada y subida en
  este repo. No aportan nada nuevo que falte.

## Opción B (Lottie) — YA implementada en este repo
- `apps/web/lib/domiAssets.ts` (manifiesto estado→asset)
- `apps/web/app/components/DomiLottie.tsx` (player, ssr:false, fallback CSS)
- `apps/web/app/components/DomiOrbAuto.tsx` (selector Lottie/CSS)
- `apps/web/public/assistant/domi/README.md` (qué assets dejar)
- Integrado en el **hero del Panel del Hogar** (DomiPanel). Sin asset → usa CSS.
- Commits: `4d1f190` (enchufe) + Domi gestos/gold posteriores.

## Diferencia con la versión de Antigravity (menor, no conflicto)
- Antigravity integró `DomiOrbAuto` también en **SmartInboxPanel** y **Guía**.
- Aquí `DomiOrbAuto` está en el **hero**; el resto usa el orb CSS.
- **Decisión correcta actual:** como **todavía NO existe el asset Lottie**, poner
  el player en cada header solo agrega peso sin beneficio visual (caería a CSS
  igual). Se mantiene Lottie en el hero; se extiende a Bandeja/Guía/otros headers
  **cuando exista el asset y se verifique** que se ve bien.

## Reglas de coordinación (para evitar dos fuentes de verdad)
1. **Un solo lugar empuja a `main`**: este flujo. Antigravity (u otro agente) NO
   debe `git push` directo a `main` desde su copia.
2. Si Antigravity (o ChatGPT/Codex) tiene cambios útiles → traerlos como **diff/PR**
   y reconciliar aquí (cuidando duplicados de DomiLottie/DomiOrbAuto).
3. Antes de cualquier push: `git fetch` + confirmar `HEAD == origin/main`.
4. El respaldo en Drive (`VantDomus_Backups/`) refleja SIEMPRE el estado de este
   repo, no el de copias paralelas.
