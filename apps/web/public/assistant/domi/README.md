# Assets de Domi (núcleo "Constelación inteligente del hogar")

Domi funciona **sin ningún archivo aquí** (usa la versión CSS/SVG). Para que el
núcleo se vea **idéntico a tu render** de la infografía, deja una imagen PNG aquí
y aparece automáticamente (sin tocar código).

## Opción A — Imagen del render (RECOMENDADO, lo más fiel)

Deja un PNG con **fondo transparente** del orbe. Nombres que Domi busca, en orden:

1. Por estado (ideal, 5 variantes — se ven los acentos correctos):
   - `sereno.png`  (dorado)
   - `motivado.png` (dorado)
   - `atento.png`  (azul)
   - `cariñoso.png` (coral)
   - `protector.png` (violeta)
   - opcionales: `pensando.png`, `logro.png`, `organizando.png`
2. Si falta el del estado, usa `domi.png` (un solo orbe dorado para todos).

> En tu infografía, la fila **"Modos emocionales adaptativos"** (arriba a la
> derecha) tiene justo esos 5 orbes limpios: recórtalos (cuadrado, orbe centrado,
> fondo transparente si puedes) y guárdalos con esos nombres.

Tamaño sugerido: 512×512 px, PNG con transparencia. La imagen se recorta en
círculo y queda como núcleo; los **chips de módulo + órbitas + halo** siguen
animándose alrededor.

## Opción B — Lottie (animación vectorial)

Si tienes el orbe como `.json` (Lottie), déjalo aquí y regístralo en
`apps/web/lib/domiAssets.ts`. Tiene prioridad sobre el CSS pero no sobre el PNG.

## Estado actual

Carpeta sin imágenes → Domi usa el núcleo CSS (ámbar + cristal + estrellas +
chips). En cuanto dejes un PNG con los nombres de arriba, se activa solo.
