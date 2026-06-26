# Assets de Domi (Lottie) — Opción B

Dejá aquí las animaciones de Domi para que se vea como el render. Formato: Lottie JSON.

Archivos esperados (uno por estado; no son todos obligatorios):
- sereno.json      (idle / por defecto — el más importante)
- atento.json      (escucha)
- pensando.json    (procesando)
- carinoso.json    (acompaña / cuidado)
- protector.json   (protege — violeta)
- logro.json       (celebra)

Luego registrá las rutas en `apps/web/lib/domiAssets.ts`. Si falta un estado,
cae a `sereno`; si tampoco existe, usa la versión CSS (DomiOrb). No hay que tocar
las pantallas: el Panel toma el asset automáticamente.

## Cómo obtener el asset (calidad render dorado glossy)
- LottieFiles.com: buscar "glowing orb / AI assistant / sphere" (hay gratis y de pago).
- Encargar a un diseñador: brief = la infografía "Constelación inteligente del
  hogar" (núcleo dorado glossy + halo + órbitas con destellos + rostro amable);
  6 estados. Exportar desde After Effects con el plugin Bodymovin → Lottie JSON.
- Alternativa interactiva: Rive (.riv) — se puede integrar después con
  @rive-app/react-canvas (no instalado aún) si se quiere máquina de estados.

## Peso recomendado
< 200 KB por archivo. Evitar imágenes embebidas pesadas; preferir vectores.
