"use client";

/**
 * DomiThemeShell — aplica el tema de ambiente (dawn/day/sunset/night) como
 * variables CSS en el documento, y ofrece un selector. Auto por hora local,
 * forzable por ?theme= o por el selector (persiste en localStorage).
 * "Un mismo Domi. Cada momento, tu ambiente."
 */
import { useEffect, useState } from "react";
import { THEMES, THEME_ORDER, THEME_LABEL, themeForHour, type ThemeKey } from "../../lib/domiThemes";

type Mode = "auto" | ThemeKey;

function applyTheme(t: ThemeKey) {
  const vars = THEMES[t];
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-vd-theme", t);
}

export default function DomiThemeShell({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("auto");
  const [resolved, setResolved] = useState<ThemeKey>("day");

  // Resolver tema al montar: ?theme= > localStorage > auto(hora)
  useEffect(() => {
    let m: Mode = "auto";
    try {
      const q = new URLSearchParams(window.location.search).get("theme");
      if (q && (THEME_ORDER as string[]).includes(q)) m = q as ThemeKey;
      else {
        const saved = localStorage.getItem("vd-theme") as Mode | null;
        if (saved) m = saved;
      }
    } catch {}
    setMode(m);
  }, []);

  // Aplicar tema (y re-evaluar cada 10 min si es auto)
  useEffect(() => {
    const pick = (): ThemeKey => (mode === "auto" ? themeForHour(new Date().getHours()) : mode);
    const t = pick(); setResolved(t); applyTheme(t);
    if (mode === "auto") {
      const id = setInterval(() => { const nt = pick(); setResolved(nt); applyTheme(nt); }, 600000);
      return () => clearInterval(id);
    }
  }, [mode]);

  function choose(m: Mode) {
    setMode(m);
    try { localStorage.setItem("vd-theme", m); } catch {}
  }

  return (
    <>
      <div className="vdThemePicker" role="group" aria-label="Ambiente">
        <button className={`vdThemeChip${mode === "auto" ? " on" : ""}`} onClick={() => choose("auto")} title="Automático por hora">Auto</button>
        {THEME_ORDER.map((t) => (
          <button key={t} className={`vdThemeChip vdt-${t}${mode === t ? " on" : ""}`} onClick={() => choose(t)} title={THEME_LABEL[t]} aria-label={THEME_LABEL[t]}>
            <span className="vdThemeDot" />
          </button>
        ))}
      </div>
      {children}
    </>
  );
}
