-- U3 I1/I2: identidad visual + estado del integrante.
--
-- avatar: identidad visual elegida por el integrante.
--   * "emoji:🐻"  → avatar ilustrado del set curado (frontend mapea el emoji)
--   * "data:image/...;base64,..." → foto subida (estilo WhatsApp)
--   * NULL → sin avatar (se usa color + inicial como hasta ahora)
--
-- status_*: "Estado del hogar" estilo WhatsApp, NATIVO y privado para la familia.
--   No es ubicación con tracking: es un check-in voluntario que el integrante
--   pone y borra cuando quiere (canon §15 Mural / §17 ubicación voluntaria).
ALTER TABLE persons ADD COLUMN avatar TEXT;
ALTER TABLE persons ADD COLUMN status_emoji TEXT;
ALTER TABLE persons ADD COLUMN status_text TEXT;
ALTER TABLE persons ADD COLUMN status_set_at TEXT;
