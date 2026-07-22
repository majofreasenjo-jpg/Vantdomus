-- OPS-2 M7.B — Suscripciones Web Push (VAPID) por dispositivo/usuario.
--
-- Cada navegador que acepta notificaciones crea una suscripción (endpoint +
-- claves p256dh/auth). El backend cifra y envía a ese endpoint cuando un
-- recordatorio vence (disparado por un Cron Job → /assistant/reminders/tick).
-- Todo esto es OPCIONAL y fail-closed: sin llaves VAPID en el entorno, el push
-- está DESHABILITADO y los recordatorios siguen avisando dentro de la app (M7.A).
--
-- endpoint es único por suscripción; si el mismo navegador re-suscribe, se
-- actualiza (upsert por endpoint).
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id             TEXT PRIMARY KEY,
  household_id   TEXT NOT NULL,
  person_id      TEXT,             -- integrante dueño del dispositivo (para dirigir el push)
  user_id        TEXT,             -- cuenta que se suscribió
  endpoint       TEXT NOT NULL,
  p256dh         TEXT NOT NULL,
  auth           TEXT NOT NULL,
  ua             TEXT,             -- user-agent (diagnóstico; sin datos sensibles)
  created_at     TEXT NOT NULL,
  last_ok_at     TEXT,             -- último envío exitoso
  failing_since  TEXT              -- si el endpoint empieza a fallar (410/404 → se borra)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wps_endpoint ON web_push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_wps_household ON web_push_subscriptions(household_id);
CREATE INDEX IF NOT EXISTS idx_wps_person ON web_push_subscriptions(person_id);
