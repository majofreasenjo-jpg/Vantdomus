# OPS-2 M10 — Música (fases MUSIC-0/1/2)

> **Estado:** MUSIC-0 funciona ya, completa y sin infra. MUSIC-1 y MUSIC-2 son
> fases posteriores que requieren que el Owner registre apps de desarrollador en
> los servicios de música (OAuth).

## MUSIC-0 — Enlaces con confirmación (LISTO)

- Página **/musica** (también en el menú "Más ▾"): la familia guarda enlaces de
  **Spotify, YouTube, Amazon Music, Deezer, SoundCloud y Apple Music**,
  etiquetados por momento (General/Calma/Energía/Estudio/Dormir/Fiesta).
- **Abrir siempre es un toque del usuario** ("▶ Abrir", pestaña nueva con
  `noopener`): nadie reproduce nada por ti — esa es la "confirmación" del canon
  en esta fase.
- **Allowlist anti-phishing:** el backend rechaza cualquier enlace que no sea
  `https` de un dominio musical conocido (p. ej. `evil.com/spotify` o
  `open.spotify.com.evil.com` NO pasan).
- **Sin OAuth, sin tokens, sin contraseñas.** Nada de música pasa por el modelo
  de IA. Borra un enlace quien lo agregó o un admin del hogar.

### Prueba real
1. Entra a `/musica`, pega un enlace de Spotify o YouTube con un nombre → queda
   en la lista con su icono de servicio.
2. Pega un enlace de un dominio cualquiera → se rechaza con mensaje claro.
3. Toca **▶ Abrir** → se abre la app/pestaña del servicio.

## MUSIC-1 — OAuth individual + control de reproducción (PENDIENTE, Owner)

Para controlar la reproducción desde VantDomus (play/pausa, elegir dispositivo):
1. **Spotify:** crear una app en developer.spotify.com → Client ID/Secret +
   redirect URI de la app. Scopes mínimos de reproducción.
2. **YouTube Music:** proyecto en Google Cloud Console + OAuth consent.
3. Guardar credenciales SOLO en el entorno de Render. Los tokens de cada
   integrante se cifran en el backend y **jamás** se envían al modelo de IA.
4. Conexión individual y revocable por integrante (canon de conectores).

## MUSIC-2 — Listas familiares + restricciones de menores (PENDIENTE)

Sobre MUSIC-1: listas compartidas del hogar, preferencias por integrante
(memoria M8, tipo `preference`), y restricciones de contenido para menores
gobernadas por la tutela (M1). Toda escritura externa (crear/modificar listas
en el servicio) requiere confirmación humana.
