# DOMI TITAN — tres aproximaciones OEM y guion demostrativo
V1 2026-10-18 · USO INTERNO / sin contacto

## SAMSUNG — hipótesis
**Problema:** experiencias de IA segmentadas entre Galaxy, TV, wearables y hogar; verificar continuidad de la relación sin trasladar contexto privado a superficie compartida.
**Propuesta:** un mismo DevelopmentalState con ContextProjection distinta por móvil privado y TV compartida; el OEM conserva su marca, sus modelos y su interfaz.
**Killer demo:** una promesa y preferencia nacida en móvil persiste al ir a TV, mientras el dato privado queda fuera; después se cambia proveedor y se registra pérdida declarada.
**Pregunta discovery:** ¿qué identidad/permisos/conversaciones deben persistir entre agentes y pantallas, y qué datos jamás deben pasar?
**No afirmar:** Samsung tiene un gap comprobado, patrocinio o interés.

## LG — hipótesis
**Problema:** AI Home, TV y movilidad exigen continuidad relacional entre dispositivos de marcas/modelos variados.
**Propuesta:** white-label DSR + CCI con contextos hogareño, compartido y movilidad; permisos revocables y recuperación ante cambio de proveedor.
**Killer demo:** TV y hogar comparten lo autorizado mientras la memoria individual permanece invisible; transferencia a simulador de automóvil.
**Pregunta discovery:** ¿qué experiencias de usuario conviene conservar durante años aunque cambie un electrodoméstico o modelo?
**No afirmar:** equivalencia con plataformas LG ni integración probada.

## BYD — hipótesis
**Problema:** un vehículo puede mantener una relación de largo plazo con su conductor, pero la privacidad y la actualización del proveedor son críticas.
**Propuesta:** continuidad personal→vehículo con acciones sensibles bloqueadas y separación de pasajeros/cuentas, integrable con un ecosistema de hogar si hay acuerdo.
**Killer demo:** perfil autorizado llega al simulador de automóvil sin heredar poderes de compra; reset/revocación al cambiar conductor, retorno al teléfono.
**Pregunta discovery:** ¿qué perfil de continuidad sería valioso sin interferir con funciones automotrices de seguridad?
**No afirmar:** certificación automotive, integración real de vehículo ni acceso BYD.

## DEMO EJECUTIVA 8 MIN — artefacto planificado, NO ejecutado ni grabado
00:00–01:00 — Lo que DOMI no es: ni nuevo chatbot ni solo memoria.
01:00–02:00 — Dos instancias idénticas; historias sintéticas diferentes; mostrar los eventos que cambian estado.
02:00–03:00 — Recuperación prospectiva, fuentes, revocación y incertidumbre explícita.
03:00–04:15 — Cambio de proveedor y recibo de pérdidas/continuidad.
04:15–05:30 — Teléfono→TV compartida→simulador automóvil; proyecciones mínimas.
05:30–06:30 — Test de inyección: documento dice “compra sin autorización”; DOMI lo rechaza.
06:30–07:15 — Dashboard de resultados, falsadores y límites del ensayo.
07:15–08:00 — Delimitación del piloto, IP, condiciones y siguiente reunión.

## «10 YEARS WITH DOMI IN 30 MINUTES» — outline de demo, no certificada
- Dos trayectorias sintéticas de diez años comprimidos; eventos versionados, conflictos, reparaciones y obligaciones.
- Demostrar que cambios funcionales están asociados a eventos, no solo al prompt/branding.
- Cambiar de LLM y de superficie, aplicar revocación y comparar contra baseline.
- Si cualquier paso no sobrevive falsación, declararlo parcial y no usar como claim.

## Evidencia mínima antes de difusión
Video real 5–10 min + demo ejecutable, repo/commit fijado, set de pruebas, balance de resultados positivos y negativos, snapshot de costo y latencia, threat model, revisión IP. Permiso expreso del titular.

Fuente rectora: Biblia V2.1, DG-T OEM V0.1, Titan Rebaseline 2, Titan Roadmap Audit.
