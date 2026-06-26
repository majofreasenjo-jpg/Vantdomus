/**
 * Parser liviano de lenguaje natural (español de Chile) para quick-add de
 * actividades. Reconoce día (hoy/mañana/pasado mañana/día de semana), hora
 * ("17:00", "a las 17", "5 pm"), recurrencia ("todos los lunes") y el título.
 * Sin dependencias; determinístico.
 */

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, "miércoles": 3, miercoles: 3,
  jueves: 4, viernes: 5, "sábado": 6, sabado: 6,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export type ParsedActivity = {
  title: string;
  dateIso: string;       // YYYY-MM-DD
  time?: string;         // HH:MM
  recurrence?: string;   // texto si detecta "todos los X"
};

/** now se inyecta para testeabilidad; por defecto el momento actual. */
export function parseActivity(input: string, now: Date = new Date()): ParsedActivity {
  let text = " " + (input || "").trim() + " ";
  const lower = text.toLowerCase();
  let date = new Date(now);
  let recurrence: string | undefined;

  // Recurrencia: "todos los lunes", "cada martes"
  const rec = lower.match(/\b(todos los|cada)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)\b/);
  if (rec) {
    recurrence = `Todos los ${rec[2]}`;
    text = text.replace(new RegExp(rec[0], "i"), " ");
  }

  // Día relativo
  let dateMatched = "";
  if (/\bpasado\s+ma[ñn]ana\b/.test(lower)) {
    date.setDate(date.getDate() + 2); dateMatched = "pasado mañana";
  } else if (/\bma[ñn]ana\b/.test(lower)) {
    date.setDate(date.getDate() + 1); dateMatched = "mañana";
  } else if (/\bhoy\b/.test(lower)) {
    dateMatched = "hoy";
  } else {
    for (const [name, dow] of Object.entries(WEEKDAYS)) {
      if (new RegExp(`\\b${name}\\b`).test(lower)) {
        const diff = (dow - date.getDay() + 7) % 7 || 7; // próximo ese día
        date.setDate(date.getDate() + diff);
        dateMatched = name;
        break;
      }
    }
  }
  if (dateMatched) {
    text = text.replace(new RegExp(`\\b${dateMatched.replace(/\s+/g, "\\s+")}\\b`, "i"), " ");
  }

  // Hora: "17:00", "17 hrs", "a las 17", "5 pm"
  let time: string | undefined;
  let hm = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hm) {
    time = `${pad(+hm[1])}:${hm[2]}`;
    text = text.replace(hm[0], " ");
  } else {
    const ampm = lower.match(/\b(\d{1,2})\s*(am|pm)\b/);
    const alas = lower.match(/\ba\s+las\s+(\d{1,2})\b/);
    const hrs = lower.match(/\b(\d{1,2})\s*(hrs?|horas?)\b/);
    if (ampm) {
      let h = +ampm[1]; if (ampm[2] === "pm" && h < 12) h += 12; if (ampm[2] === "am" && h === 12) h = 0;
      time = `${pad(h)}:00`; text = text.replace(ampm[0], " ");
    } else if (alas) {
      time = `${pad(+alas[1])}:00`; text = text.replace(alas[0], " ");
    } else if (hrs) {
      time = `${pad(+hrs[1])}:00`; text = text.replace(hrs[0], " ");
    }
  }

  // Limpiar conectores sueltos y espacios
  const title = text
    .replace(/\b(a las|el|la|los|de|del)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "Actividad";

  const dateIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return { title: title.charAt(0).toUpperCase() + title.slice(1), dateIso, time, recurrence };
}
