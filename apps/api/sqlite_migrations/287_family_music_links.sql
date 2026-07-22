-- OPS-2 M10 — MUSIC-0: biblioteca musical familiar por ENLACES.
--
-- Fase 0 del canon de música: la familia guarda enlaces de servicios musicales
-- (Spotify/YouTube/Amazon/Deezer/SoundCloud/Apple) etiquetados por momento, y se
-- abren con acción explícita del usuario. SIN OAuth, SIN tokens, SIN passwords;
-- nada de esto pasa por el modelo. El backend VALIDA que el enlace pertenezca a
-- un dominio musical permitido (allowlist anti-phishing).
-- MUSIC-1 (OAuth + control de reproducción) y MUSIC-2 (listas familiares +
-- restricciones de menores) son fases posteriores con infra del Owner.
CREATE TABLE IF NOT EXISTS family_music_links (
  id                TEXT PRIMARY KEY,
  household_id      TEXT NOT NULL,
  person_id         TEXT,             -- para quién es (opcional; NULL = de la familia)
  added_by_user_id  TEXT,
  title             TEXT NOT NULL,
  url               TEXT NOT NULL,
  service           TEXT NOT NULL,    -- spotify|youtube|amazon|deezer|soundcloud|apple
  mood              TEXT NOT NULL DEFAULT 'general'
                    CHECK (mood IN ('general','calma','energia','estudio','dormir','fiesta')),
  created_at        TEXT NOT NULL,
  deleted_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_fml_household ON family_music_links(household_id, mood);
