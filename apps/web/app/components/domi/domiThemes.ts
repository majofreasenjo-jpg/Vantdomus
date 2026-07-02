/**
 * domiThemes — temas dawn/day/sunset/night del prototipo aprobado (port
 * literal desde App.tsx). Auto por hora local + override ?theme=.
 */

export type DomiTheme = "dawn" | "day" | "sunset" | "night";

export const themesConfig = {
  dawn: {
    bg: "bg-gradient-to-br from-[#E2E9FF] via-[#FFF1E0] to-[#FFEBEA]",
    glow1: "from-[#FFB088]/40 via-[#FF88B0]/25 to-transparent",
    glow2: "from-[#FFE699]/45 via-[#FFB84D]/25 to-transparent",
    glow3: "from-[#FF99B0]/25 to-transparent",
    title: "Amanecer de Calma",
    badge: "bg-orange-500/15 text-orange-800 border-orange-500/30 font-bold",
    time: "07:30",
    temp: "23°C",
    ambientMode: "Mañana activa"
  },
  day: {
    bg: "bg-gradient-to-br from-[#FFFFFF] via-[#EAF3FA] to-[#EDF6FF]",
    glow1: "from-[#88C0FF]/45 via-[#4DB8FF]/30 to-transparent",
    glow2: "from-[#99FFF3]/35 via-[#4DFFEB]/20 to-transparent",
    glow3: "from-[#FFEAA8]/30 to-transparent",
    title: "Día Activo",
    badge: "bg-sky-500/15 text-sky-800 border-sky-500/30 font-bold",
    time: "14:15",
    temp: "22°C",
    ambientMode: "Tarde productiva"
  },
  sunset: {
    bg: "bg-gradient-to-br from-[#120B2E] via-[#2F0E31] to-[#1E0513]",
    glow1: "from-rose-600/25 via-purple-600/15 to-transparent",
    glow2: "from-orange-500/20 via-amber-600/10 to-transparent",
    glow3: "from-violet-500/12 to-transparent",
    title: "Atardecer Cálido",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/35",
    time: "19:45",
    temp: "21°C",
    ambientMode: "Noche tranquila"
  },
  night: {
    bg: "bg-gradient-to-br from-[#060B21] via-[#090D26] to-[#03040D]",
    glow1: "from-violet-600/22 via-indigo-950/15 to-transparent",
    glow2: "from-amber-500/20 via-orange-500/10 to-transparent",
    glow3: "from-blue-500/12 to-transparent",
    title: "Noche Serena",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/35",
    time: "22:30",
    temp: "20°C",
    ambientMode: "Noche tranquila"
  }
};

export const getInitialTheme = (): "dawn" | "day" | "sunset" | "night" => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const themeParam = params.get("theme") as "dawn" | "day" | "sunset" | "night";
    if (themeParam && ["dawn", "day", "sunset", "night"].includes(themeParam)) {
      return themeParam;
    }
  }
  const hrs = new Date().getHours();
  if (hrs >= 6 && hrs < 9) return "dawn";
  if (hrs >= 9 && hrs < 18) return "day";
  if (hrs >= 18 && hrs < 21) return "sunset";
  return "night";
};
