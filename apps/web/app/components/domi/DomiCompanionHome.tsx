"use client";

/**
 * DomiCompanionHome — port del App.tsx aprobado de Google AI Studio (CP1b).
 * Regla del port: GOOGLE DISENO LA EXPERIENCIA; aqui solo se adapta a Next
 * (imports, shim de motion, motor local de chat, dev panel oculto). El JSX
 * y las clases visuales se conservan casi literales.
 */
import "./domi.css";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "./domiMotion";
import { 
  Sparkles, 
  Moon, 
  Sun, 
  Compass, 
  ShieldCheck, 
  Plus, 
  Bell, 
  ChevronDown, 
  VolumeX, 
  Volume2, 
  HelpCircle,
  TrendingUp,
  Sliders,
  CheckCircle,
  AlertTriangle,
  X,
  Mic,
  FileText,
  UploadCloud,
  Search,
  Trash2,
  Download,
  BookOpen,
  Heart,
  ShoppingCart,
  Clock,
  Calendar,
  Play,
  RotateCcw,
  Folder,
  ChefHat,
  Rocket,
  Wand2,
  Maximize2,
  Minimize2,
  ExternalLink
} from "lucide-react";

import { ShoppingItem, StudyBlock, ChatMessage, HomeNotification, FamilyMember, DomiState, domiStateTokens } from "./domiTypes";
import DomiOrb from "./DomiOrb";
import StatusCards from "./StatusCards";
import Modals from "./Modals";
import DomiChat from "./DomiChat";
import EquilibrioChart from "./EquilibrioChart";
import { themesConfig, getInitialTheme } from "./domiThemes";
import { generateDomiReply } from "./domiIntents";


// Flag to control visibility of the dev switcher panel. 
// If true, the panel trigger button is shown.
// If false, it's completely hidden from the user interface and DOM unless the query param ?dev=1 is specified.
const DEV_PANEL_ENABLED = false;

export interface DomiHomeData {
  /** Datos reales del hogar (opcionales). Si faltan, se usa el fallback demo
   *  del prototipo aprobado — marcado como demo, no como dato real. */
  shoppingItems?: ShoppingItem[];
  familyMembers?: FamilyMember[];
}

export default function DomiCompanionHome({ data }: { data?: DomiHomeData }) {
  // --- DEV PANEL STATES ---
  const [devModeActive, setDevModeActive] = useState(() => {
    // Port: dev panel oculto por defecto; solo ?dev=1 (o Ctrl+Shift+D en local).
    if (typeof window === "undefined") return DEV_PANEL_ENABLED;
    const q = new URLSearchParams(window.location.search).get("dev");
    return DEV_PANEL_ENABLED || q === "1" || q === "true";
  });
  const [devPanelOpen, setDevPanelOpen] = useState(false);

  // --- APPLICATION STATES ---
  const [activeTheme, setActiveTheme] = useState<"dawn" | "day" | "sunset" | "night">(getInitialTheme());
  const [domiAppearance, setDomiAppearance] = useState<
    "original" | "estudio" | "calma" | "protector" | "cercano" | "noche" | "senior" | "chef" | "astronaut" | "detective" | "wizard"
  >(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const appearanceParam = params.get("domiAppearance") || params.get("domiCostume");
      if (appearanceParam && [
        "original", "estudio", "calma", "protector", "cercano", "noche", "senior",
        "chef", "astronaut", "detective", "wizard"
      ].includes(appearanceParam)) {
        return appearanceParam as any;
      }
    }
    return "original";
  });

  // --- FULLSCREEN STATES & HANDLERS ---
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInIframe(window.self !== window.top);
    }
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
        addNotification("Pantalla completa", "Se activó el modo pantalla completa.", "system");
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen request rejected or not supported. Might be within an iframe sandbox without allow-fullscreen.");
      if (window.self !== window.top) {
        addNotification("Límite de visor", "La plataforma contiene la app en un cuadro. Usa el botón 'Abrir en pestaña nueva' para pantalla completa.", "system");
      } else {
        addNotification("Límite de navegador", "Tu navegador bloqueó el modo pantalla completa automático.", "system");
      }
    }
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== "undefined") {
      window.open(window.location.href, "_blank");
      addNotification("Abriendo en pestaña nueva", "Disfruta de VantDomus Hogar en una pestaña dedicada.", "system");
    }
  };
  
  const [domiState, setDomiState] = useState<DomiState>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const stateParam = params.get("domiState") as DomiState;
      if (stateParam && [
        "listo", "escuchando", "pensando", "proponiendo", "esperando_confirmacion",
        "protector", "calma", "cercano", "alegre", "descanso"
      ].includes(stateParam)) {
        return stateParam;
      }
    }
    return "listo";
  });
  const [activeTab, setActiveTab] = useState<"inicio" | "hoy" | "documentos" | "mas">("inicio");
  const [medicineConfirmed, setMedicineConfirmed] = useState(false);
  const [studyPrepared, setStudyPrepared] = useState(false);
  
  // Default shopping list (Faltan 9 productos)
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => data?.shoppingItems?.length ? data.shoppingItems : [
    { id: "1", name: "Leche semidescremada", checked: false, qty: "2 L", category: "Supermercado" },
    { id: "2", name: "Plátanos maduros", checked: false, qty: "1 Kg", category: "Frutería" },
    { id: "3", name: "Pan de molde integral", checked: false, qty: "1 ud", category: "Panadería" },
    { id: "4", name: "Jabón líquido de manos", checked: false, qty: "1 ud", category: "Farmacia" },
    { id: "5", name: "Detergente de ropa", checked: false, qty: "1 L", category: "Supermercado" },
    { id: "6", name: "Pechuga de pollo", checked: false, qty: "500g", category: "Supermercado" },
    { id: "7", name: "Tomates frescos", checked: false, qty: "4 uds", category: "Frutería" },
    { id: "8", name: "Yogurt griego natural", checked: false, qty: "4 uds", category: "Supermercado" },
    { id: "9", name: "Café molido gourmet", checked: false, qty: "250g", category: "Supermercado" }
  ]);

  // Study blocks for Diego
  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([
    { id: "1", time: "16:00 - 16:45", subject: "Álgebra y Ecuaciones", duration: "45m" },
    { id: "2", time: "17:00 - 17:45", subject: "Práctica de Geometría", duration: "45m" },
    { id: "3", time: "18:00 - 18:30", subject: "Simulacro de Examen", duration: "30m" }
  ]);

  // Family members list
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => data?.familyMembers?.length ? data.familyMembers : [
    { id: "mama", name: "Mamá (Gabriela)", role: "Madre", avatar: "G", status: "En el trabajo" },
    { id: "papa", name: "Papá (Carlos)", role: "Padre", avatar: "C", status: "Preparando la cena" },
    { id: "diego", name: "Diego", role: "Hijo - Estudiante", avatar: "D", status: "Estudiando matemáticas" },
    { id: "elena", name: "Elena", role: "Abuela", avatar: "E", status: "Descansando en su cuarto" }
  ]);

  // Logs for medicine confirmation
  const [medicineLogs, setMedicineLogs] = useState<{ time: string; confirmedBy: string }[]>([]);

  // Breathing simulation state
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingCycle, setBreathingCycle] = useState<"inhale" | "hold" | "exhale" | "idle">("idle");
  const [breathingProgress, setBreathingProgress] = useState(0);

  // Suggested atmosphere/ambient state
  const [ambientMode, setAmbientMode] = useState("Noche tranquila");
  const [temperature, setTemperature] = useState("21°C");
  const [time, setTime] = useState("22:30");
  const [showAmbientMenu, setShowAmbientMenu] = useState(false);

  // Domi visual expression/mood
  const [domiMood, setDomiMood] = useState<"happy" | "speaking" | "breathing" | "thinking">("happy");

  // Notifications audit trail
  const [notifications, setNotifications] = useState<HomeNotification[]>([
    { id: "n1", title: "Medicina programada", message: "Toma de metformina de Elena programada para las 21:30.", timestamp: "21:00", type: "care" },
    { id: "n2", title: "Bienestar sugerido", message: "Modo relajación recomendado por Domi debido al descanso nocturno.", timestamp: "20:30", type: "system" },
    { id: "n3", title: "Seguridad activa", message: "Cierre de puertas perimetrales y alarma nocturna conectada.", timestamp: "22:00", type: "security" }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  // States to trigger a vibrant ping pulse on the brand emblem when notifications arrive
  const [isLogoPulsing, setIsLogoPulsing] = useState(false);
  const [logoPulseCount, setLogoPulseCount] = useState(0);
  const isFirstNotificationsRender = useRef(true);
  const [isWakingUp, setIsWakingUp] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsWakingUp(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const queryParams = new URLSearchParams(window.location.search);
      const isDevQuery = queryParams.get("dev") === "1" || queryParams.get("dev") === "true";
      const devMode = DEV_PANEL_ENABLED || isDevQuery;

      if (devMode && (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setDevPanelOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isFirstNotificationsRender.current) {
      isFirstNotificationsRender.current = false;
      return;
    }
    setIsLogoPulsing(true);
    setLogoPulseCount(prev => prev + 1);
    const timer = setTimeout(() => setIsLogoPulsing(false), 1000);
    return () => clearTimeout(timer);
  }, [notifications.length]);

  // Modals Visibility
  const [modals, setModals] = useState({
    care: false,
    study: false,
    shopping: false,
    family: false,
    summary: false
  });

  // --- ADDITIONAL WORKSPACE STATES ---
  const [documents, setDocuments] = useState<{
    id: string;
    name: string;
    category: "salud" | "educacion" | "hogar" | "recetas";
    size: string;
    date: string;
    uploader: string;
  }[]>([
    { id: "doc1", name: "Receta Metformina Elena.pdf", category: "salud", size: "342 KB", date: "Hoy, 10:15", uploader: "Domi" },
    { id: "doc2", name: "Boletín Académico Diego.pdf", category: "educacion", size: "1.2 MB", date: "Ayer, 16:30", uploader: "Papá (Carlos)" },
    { id: "doc3", name: "Manual Caldera Inteligente.pdf", category: "hogar", size: "4.5 MB", date: "15 Jun 2026", uploader: "Mamá (Gabriela)" },
    { id: "doc4", name: "Póliza Seguro Hogar 2026.pdf", category: "hogar", size: "2.1 MB", date: "01 Ene 2026", uploader: "Papá (Carlos)" },
    { id: "doc5", name: "Recetario Saludable Familiar.pdf", category: "recetas", size: "850 KB", date: "12 May 2026", uploader: "Mamá (Gabriela)" },
  ]);

  const [documentSearch, setDocumentSearch] = useState("");
  const [selectedDocCategory, setSelectedDocCategory] = useState<"todos" | "salud" | "educacion" | "hogar" | "recetas">("todos");
  
  // Interactive study timer for Diego
  const [studyTimerActive, setStudyTimerActive] = useState(false);
  const [studyTimeLeft, setStudyTimeLeft] = useState(2700); // 45m default
  const [studyActiveBlockId, setStudyActiveBlockId] = useState<string | null>(null);

  // Tick the study timer
  useEffect(() => {
    let interval: any;
    if (studyTimerActive && studyTimeLeft > 0) {
      interval = setInterval(() => {
        setStudyTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (studyTimeLeft === 0 && studyTimerActive) {
      setStudyTimerActive(false);
      addNotification("Bloque de estudio completado", "¡Excelente esfuerzo! Diego ha terminado su bloque de estudio con éxito.", "study");
    }
    return () => clearInterval(interval);
  }, [studyTimerActive, studyTimeLeft]);

  // Chat message logs with default greetings
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "model",
      content: "¡Buenas noches! Soy Domi, tu compañero inteligente en VantDomus Hogar. Estoy orquestando los flujos de calma y bienestar en tu casa hoy. Veo que Elena tiene pendiente la confirmación de su medicamento nocturno y faltan algunos artículos en la lista. ¿En qué te ayudo?",
      timestamp: new Date()
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Audio synthesizer ref
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // --- CLOCK AND TIME TIMER ---
  useEffect(() => {
    // Update real local clock, formatting nicely
    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, "0");
      const mins = String(now.getMinutes()).padStart(2, "0");
      setTime(`${hrs}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- BREATHING ROUTINE CONTROLLER ---
  useEffect(() => {
    if (!breathingActive) {
      setBreathingCycle("idle");
      setDomiMood("happy");
      return;
    }

    setDomiMood("breathing");
    setDomiState("calma");
    setBreathingProgress(60);

    let progress = 60;
    let secondsInPhase = 0;
    let currentPhase: "inhale" | "hold" | "exhale" = "inhale";
    setBreathingCycle(currentPhase);

    const timer = setInterval(() => {
      progress -= 1;
      setBreathingProgress(progress);
      secondsInPhase += 1;

      // Handle breathing loop sequence: Inhale 4s -> Hold 2s -> Exhale 4s
      if (currentPhase === "inhale" && secondsInPhase >= 4) {
        currentPhase = "hold";
        secondsInPhase = 0;
        setBreathingCycle("hold");
      } else if (currentPhase === "hold" && secondsInPhase >= 2) {
        currentPhase = "exhale";
        secondsInPhase = 0;
        setBreathingCycle("exhale");
      } else if (currentPhase === "exhale" && secondsInPhase >= 4) {
        currentPhase = "inhale";
        secondsInPhase = 0;
        setBreathingCycle("inhale");
      }

      if (progress <= 0) {
        clearInterval(timer);
        setBreathingActive(false);
        setBreathingCycle("idle");
        setDomiMood("happy");
        setDomiState(activeTheme === "night" ? "descanso" : "listo");
        addNotification(
          "Ejercicio de respiración completado",
          "¡Bien hecho! Tu hogar agradece este momento de calma y conexión.",
          "system"
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [breathingActive, activeTheme]);

  // --- WEB AUDIO AMBIENT DRONE SYNTHESIZER ---
  const startAmbientSynth = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      
      // Setup a low oscillator to simulate an ambient soothing pad sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(165, ctx.currentTime); // Warm chord (E3, G3 pitch drone)
      
      // Gentle modulation LFO to simulate ocean waves
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.25; // 4 seconds wave cycle
      lfoGain.gain.value = 0.03; 
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.04, ctx.currentTime); 
      osc.start();
      
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
      setIsMusicPlaying(true);
      addNotification("Música ambiental activa", "Domi está reproduciendo acordes suaves para relajación.", "system");
    } catch (e) {
      console.warn("Audio Synthesis is not supported in this iframe environment.");
    }
  };

  const stopAmbientSynth = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {}
      oscillatorRef.current = null;
    }
    setIsMusicPlaying(false);
  };

  const toggleMusic = () => {
    if (isMusicPlaying) {
      stopAmbientSynth();
      setDomiState(activeTheme === "night" ? "descanso" : "listo");
    } else {
      startAmbientSynth();
      setDomiState("calma");
    }
  };

  // --- CORE SETTERS & STATE HANDLERS ---
  const addNotification = (title: string, message: string, type: "care" | "study" | "shopping" | "security" | "system") => {
    const newNotif: HomeNotification = {
      id: `n-${Date.now()}`,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const confirmMedicine = (confirmed: boolean, name?: string) => {
    setMedicineConfirmed(confirmed);
    if (confirmed) {
      const loggerName = name || "Mamá";
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMedicineLogs(prev => [{ time: timeStr, confirmedBy: loggerName }, ...prev]);
      addNotification(
        "Medicamento Confirmado",
        `Dosis confirmada por ${loggerName} a las ${timeStr}. Elena está cuidada.`,
        "care"
      );
      setDomiState("alegre");
      setTimeout(() => {
        setDomiState(activeTheme === "night" ? "descanso" : "listo");
      }, 4000);
    } else {
      addNotification("Registro Modificado", "Se ha revertido la confirmación de medicamentos.", "care");
      setDomiState(activeTheme === "night" ? "descanso" : "listo");
    }
  };

  const handleToggleShoppingItem = (id: string) => {
    setShoppingItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextState = !item.checked;
        addNotification(
          nextState ? "Artículo Comprado" : "Artículo Pendiente",
          `"${item.name}" fue marcado como ${nextState ? "comprado" : "pendiente"}.`,
          "shopping"
        );
        return { ...item, checked: nextState };
      }
      return item;
    }));
  };

  const handleAddShoppingItem = (name: string, qty: string = "1 ud", category: string = "Supermercado") => {
    const newItem: ShoppingItem = {
      id: `shop-${Date.now()}`,
      name,
      checked: false,
      qty,
      category
    };
    setShoppingItems(prev => [...prev, newItem]);
    addNotification("Lista de compras actualizada", `Se agregó "${name}" (${qty}) a la despensa.`, "shopping");
  };

  const handleDeleteShoppingItem = (id: string) => {
    const item = shoppingItems.find(i => i.id === id);
    if (item) {
      setShoppingItems(prev => prev.filter(i => i.id !== id));
      addNotification("Artículo Eliminado", `Se eliminó "${item.name}" de la lista.`, "shopping");
    }
  };

  const handlePrepareStudy = () => {
    setDomiState("pensando");
    setDomiMood("thinking");
    addNotification("Analizando contenido", "Domi está procesando los temarios escolares de Diego...", "study");
    
    setTimeout(() => {
      setStudyPrepared(true);
      setDomiState("proponiendo");
      setDomiMood("happy");
      addNotification(
        "Plan de Estudio Organizado",
        "Domi ha estructurado los bloques de repaso de Diego. ¡Álgebra lista!",
        "study"
      );
      setTimeout(() => {
        setDomiState(activeTheme === "night" ? "descanso" : "listo");
      }, 4000);
    }, 2000);
  };

  const handleUpdateFamilyStatus = (id: string, status: string) => {
    setFamilyMembers(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  };

  const handleSimulatedUpload = (name: string, category: "salud" | "educacion" | "hogar" | "recetas", size: string) => {
    const newDoc = {
      id: `doc-${Date.now()}`,
      name,
      category,
      size,
      date: "Hoy, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      uploader: "Mamá (Gabriela)"
    };
    setDocuments(prev => [newDoc, ...prev]);
    addNotification("Documento subido", `Se ha agregado "${name}" al repositorio familiar.`, "system");
  };

  const handleDeleteDocument = (id: string) => {
    const docToDelete = documents.find(d => d.id === id);
    if (docToDelete) {
      setDocuments(prev => prev.filter(d => d.id !== id));
      addNotification("Documento eliminado", `Se ha borrado "${docToDelete.name}" de la nube familiar.`, "system");
    }
  };

  const triggerListeningSimulation = () => {
    if (isListening) {
      setIsListening(false);
      setDomiMood("happy");
      setDomiState("listo");
    } else {
      setIsListening(true);
      setDomiMood("speaking");
      setDomiState("escuchando");
      addNotification("Micrófono Activado", "Domi está escuchando comandos de voz...", "system");
      
      // Simulate speaking or capturing command after 3.5 seconds
      setTimeout(() => {
        setIsListening(false);
        setDomiMood("thinking");
        setDomiState("pensando");
        sendMessageToDomi("¿Elena tomó su medicina?");
      }, 3500);
    }
  };

  // --- INTEGRATION CHAT FLOW WITH SERVER AND ACTION TRIGGERS ---
  const sendMessageToDomi = async (text: string) => {
    if (!text.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsSending(true);
    setDomiMood("thinking");
    setDomiState("pensando");

    try {
      // Port CP1b: el prototipo llamaba a un server Express+Gemini (/api/chat).
      // Aqui la respuesta se genera LOCALMENTE por reglas (sin red, sin IA
      // externa) manteniendo el mismo contrato { text, action }.
      await new Promise((r) => setTimeout(r, 650)); // pequena pausa "pensando"
      const data = generateDomiReply(text, {
        medicineConfirmed,
        studyPrepared,
        shoppingItems,
        ambientMode,
        temperature,
        time
      });

      const domiReply: ChatMessage = {
        id: `domi-${Date.now()}`,
        role: "model",
        content: data.text || "He recibido tu mensaje correctamente, pero no logré estructurar la acción.",
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, domiReply]);
      setDomiMood("speaking");
      
      // Reactively set Domi's state based on text or actions!
      const lowerText = text.toLowerCase();
      if (lowerText.includes("respira") || lowerText.includes("calma") || lowerText.includes("relaj") || lowerText.includes("ansiedad")) {
        setDomiState("calma");
      } else if (lowerText.includes("proteg") || lowerText.includes("seguridad") || lowerText.includes("puerta") || lowerText.includes("cerrar")) {
        setDomiState("protector");
      } else if (lowerText.includes("tomó") || lowerText.includes("medicina") || lowerText.includes("médic") || lowerText.includes("confirmar")) {
        setDomiState("alegre");
      } else if (lowerText.includes("estudio") || lowerText.includes("matemát") || lowerText.includes("diego") || lowerText.includes("prepara")) {
        setDomiState("proponiendo");
      } else if (lowerText.includes("compras") || lowerText.includes("leche") || lowerText.includes("frut")) {
        setDomiState("cercano");
      } else {
        setDomiState("listo");
      }

      setTimeout(() => {
        setDomiMood("happy");
        // Revert to descanso if night theme and we were just responding
        if (activeTheme === "night" && !lowerText.includes("respira") && !lowerText.includes("proteg")) {
          setDomiState("descanso");
        }
      }, 4000);

      // Execute AI action trigger if returned from Gemini
      if (data.action && data.action.type !== "NONE") {
        executeAIAction(data.action.type, data.action.payload);
      }

    } catch (err) {
      console.error(err);
      const errorReply: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "model",
        content: "He tenido un pequeño corte de conexión con el núcleo central, pero sigo operando localmente. ¿En qué te asisto?",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorReply]);
      setDomiMood("happy");
      setDomiState("listo");
    } finally {
      setIsSending(false);
    }
  };

  const executeAIAction = (actionType: string, payload?: string) => {
    switch (actionType) {
      case "CONFIRM_MEDICATION":
        confirmMedicine(true, "Domi (Asistente)");
        break;
      case "PREPARE_STUDY":
        handlePrepareStudy();
        break;
      case "ADD_SHOPPING_ITEM":
        handleAddShoppingItem(payload || "Nuevo producto", "1 ud");
        break;
      case "TOGGLE_SHOPPING_ITEM":
        const itemToToggle = shoppingItems.find(i => i.name.toLowerCase().includes((payload || "").toLowerCase()));
        if (itemToToggle) handleToggleShoppingItem(itemToToggle.id);
        break;
      case "BREATHE":
        setBreathingActive(true);
        break;
      case "CHANGE_AMBIENT":
        setAmbientMode(payload || "Noche tranquila");
        if (payload === "Mañana activa") {
          setTemperature("23°C");
        } else if (payload === "Tarde productiva") {
          setTemperature("22°C");
        } else {
          setTemperature("21°C");
        }
        addNotification("Ambiente cambiado", `El hogar ha cambiado a "${payload || 'Noche tranquila'}"`, "system");
        break;
      default:
        break;
    }
  };

  // Open appropriate modals from node clicks
  const handleNodeClick = (nodeType: string) => {
    setModals(prev => {
      const next = { ...prev };
      if (nodeType === "salud") next.care = true;
      if (nodeType === "compras") next.shopping = true;
      if (nodeType === "estudio") next.study = true;
      if (nodeType === "bienestar") next.care = false; // special trigger
      if (nodeType === "mensajes") setShowNotifications(true);
      if (nodeType === "servicios") next.summary = true;
      if (nodeType === "domi" || nodeType === "bienestar") {
        // Toggle breathing directly or initiate chat
        if (nodeType === "bienestar") {
          setBreathingActive(prev => !prev);
        }
      }
      return next;
    });
  };

  const handleAmbientChange = (mode: string, temp: string) => {
    setAmbientMode(mode);
    setTemperature(temp);
    setShowAmbientMenu(false);
    addNotification("Sugerencia de Ambiente", `Has seleccionado el modo "${mode}" con temperatura de ${temp}.`, "system");
  };

  const getGreetingData = () => {
    if (activeTheme === "dawn") return { greeting: "Buenos", word: "días." };
    if (activeTheme === "day") return { greeting: "Buenas", word: "tardes." };
    if (activeTheme === "sunset") return { greeting: "Buenas", word: "tardes." };
    return { greeting: "Buenas", word: "noches." };
  };

  const getAvatarGradient = (avatar: string) => {
    if (avatar === "G") return "bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]";
    if (avatar === "C") return "bg-gradient-to-tr from-blue-500 to-teal-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]";
    if (avatar === "D") return "bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]";
    return "bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]";
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleSimulatedDownload = (docName: string) => {
    addNotification("Descarga iniciada", `Iniciando descarga de "${docName}"...`, "system");
  };

  const bgConfig = themesConfig[activeTheme];
  const isLight = activeTheme === "dawn" || activeTheme === "day";
  const { greeting, word } = getGreetingData();

  const stateToken = domiStateTokens[domiState];
  const domiSubtext = domiState === "listo" ? "Domi orquesta tu hogar para que vivas en calma, conexión y bienestar." :
                      domiState === "escuchando" ? "Sintonizando con tu voz en tiempo real. Dime qué necesitas resolver hoy." :
                      domiState === "pensando" ? "Analizando variables y cruzando agendas familiares para optimizar tu día." :
                      domiState === "proponiendo" ? "He diseñado un plan ideal para Diego y Elena. Te propongo revisarlo." :
                      domiState === "esperando_confirmacion" ? "Esta acción requiere autorización humana directa antes de ejecutarse." :
                      domiState === "protector" ? "Monitoreando cerraduras, iluminación y el bienestar general del hogar." :
                      domiState === "calma" ? "Regulemos juntos el ritmo respiratorio para disipar la tensión diaria." :
                      domiState === "cercano" ? "Acompañándote con empatía y calidez en cada pequeña tarea del día." :
                      domiState === "alegre" ? "¡Excelente! Hemos completado el flujo de forma exitosa y coordinada." :
                      "Velando en silencio por el descanso y la seguridad de toda la familia.";

  return (
    <div id="vantdomus-app" className={`h-screen lg:h-[100dvh] lg:max-h-[100dvh] w-full ${bgConfig.bg} relative flex flex-col justify-between p-3 md:p-4 lg:py-4 lg:px-6 xl:px-8 overflow-y-auto lg:overflow-hidden select-none font-sans ${isLight ? "text-indigo-950" : "text-slate-100"} transition-all duration-1000`}>
      
      {/* High-precision Compact Viewport Constraints on Desktop */}
      <style>{`
        @media (min-width: 1024px) and (max-height: 880px) {
          #vantdomus-app {
            padding: 12px 20px !important;
            gap: 8px !important;
          }
          header {
            margin-bottom: 2px !important;
            height: 44px !important;
          }
          .hero-section {
            height: 42dvh !important;
            min-height: 250px !important;
          }
          .status-card-item {
            padding: 10px 14px !important;
          }
          .status-card-item p {
            margin-bottom: 8px !important;
          }
          .status-card-item button {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
          .bottom-mini-card {
            display: none !important;
          }
          .voice-dock-container {
            grid-column: 1 / -1 !important;
          }
          .desc-text {
            display: none !important;
          }
        }
      `}</style>
      
      {/* Subtle inner border framing the premium digital hardware look */}
      <div className="absolute inset-2 border border-white/[0.03] rounded-[24px] pointer-events-none z-50 hidden lg:block" />

      {/* Absolute background ambient glows (Dynamic based on time of day) */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr ${bgConfig.glow1} rounded-full blur-[120px] pointer-events-none`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-bl ${bgConfig.glow2} rounded-full blur-[120px] pointer-events-none`} />
      <div className={`absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-radial ${bgConfig.glow3} rounded-full blur-[100px] pointer-events-none`} />

      {/* 1. APP TOP BAR HEADER */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full z-30 shrink-0 mb-1">
        {/* Left Brand block with the exact Vantdomus geometric icon and branding */}
        <div className="flex items-center gap-3">
          <motion.div 
            className="relative w-11 h-11 rounded-full border border-amber-400/35 flex items-center justify-center bg-radial from-amber-500/20 to-transparent glow-gold shrink-0"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={isWakingUp ? {
              opacity: 1,
              scale: 1,
              boxShadow: "0 0 35px 6px rgba(245, 158, 11, 0.45)"
            } : (isLogoPulsing ? {
              opacity: 1,
              scale: [1, 1.25, 1],
              boxShadow: [
                "0 0 15px 0px rgba(245, 158, 11, 0.15)",
                "0 0 45px 15px rgba(245, 158, 11, 0.75)",
                "0 0 15px 0px rgba(245, 158, 11, 0.15)"
              ]
            } : {
              opacity: 1,
              scale: [1, 1.06, 1],
              boxShadow: [
                "0 0 15px 0px rgba(245, 158, 11, 0.15)",
                "0 0 35px 6px rgba(245, 158, 11, 0.45)",
                "0 0 15px 0px rgba(245, 158, 11, 0.15)"
              ]
            })}
            transition={isWakingUp ? {
              duration: 1.5,
              ease: [0.34, 1.56, 0.64, 1]
            } : (isLogoPulsing ? {
              duration: 0.6,
              ease: "easeOut"
            } : {
              duration: 4,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "reverse"
            })}
          >
            {/* Animated radial 'aura' glow behind the emblem */}
            <motion.div
              className="absolute -inset-4 rounded-full pointer-events-none -z-10"
              style={{
                background: "radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, rgba(251, 191, 36, 0.15) 50%, transparent 75%)",
                maskImage: "radial-gradient(circle, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)",
                WebkitMaskImage: "radial-gradient(circle, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)",
              }}
              animate={{
                scale: [0.85, 1.15, 0.85],
                opacity: [0.4, 0.9, 0.4],
              }}
              transition={{
                duration: 5,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />

            {/* Ping Concentric Ring Overlay */}
            <AnimatePresence>
              {logoPulseCount > 0 && isLogoPulsing && (
                <motion.span 
                  key={`ping-${logoPulseCount}`}
                  className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none"
                  initial={{ opacity: 0.8, scale: 1 }}
                  animate={{ opacity: 0, scale: 2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.0, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>

            {/* Masked Sweeping Shine Flare Overlay */}
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(110deg, transparent 35%, rgba(255, 255, 255, 0.35) 45%, rgba(255, 255, 255, 0.65) 50%, rgba(255, 255, 255, 0.35) 55%, transparent 65%)",
                  width: "200%",
                  height: "100%",
                  left: "-50%",
                }}
                animate={{
                  x: ["-100%", "100%"]
                }}
                transition={{
                  duration: 1.8,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 6.2,
                }}
              />
            </div>

            {/* Custom mini gold Domi brand icon (cristalino y tierno, no escudo metalico) */}
            <svg className="w-7 h-7 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" viewBox="0 0 40 40">
              <defs>
                <radialGradient id="miniDomiGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FFF7D8" />
                  <stop offset="30%" stopColor="#FFE8A8" />
                  <stop offset="70%" stopColor="#F8B84E" />
                  <stop offset="100%" stopColor="#B96F16" />
                </radialGradient>
              </defs>
              <circle cx="20" cy="20" r="14" fill="url(#miniDomiGrad)" />
              <circle cx="20" cy="20" r="17" fill="none" stroke="#F4C86A" strokeWidth="1.0" strokeDasharray="2 2" opacity="0.75" />
              <circle cx="16" cy="18" r="1.5" fill="#1d0a00" />
              <circle cx="24" cy="18" r="1.5" fill="#1d0a00" />
              <path d="M 17 22 Q 20 24.5 23 22" fill="none" stroke="#1d0a00" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0.5 border border-dashed border-amber-500/10 rounded-full animate-spin-slow" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-base font-bold font-display tracking-wide leading-none ${isLight ? "text-slate-900" : "text-slate-100"}`}>VantDomus Hogar</h1>
              <span className="px-2 py-0.5 text-[8.5px] font-bold text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full tracking-wider uppercase font-mono">Domi listo</span>
            </div>
            <span className={`text-[10px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>Tu hogar, en calma y conexión</span>
          </div>
        </div>

        {/* Center navigation menu pill capsule */}
        <nav className={`flex p-1 rounded-full border backdrop-blur-md transition-all duration-500 ${
          isLight ? "bg-white/80 border-slate-200/50 shadow-sm" : "bg-slate-900/70 border-slate-800/80"
        }`}>
          {[
            { id: "inicio", label: "Inicio" },
            { id: "hoy", label: "Hoy" },
            { id: "documentos", label: "Documentos" },
            { id: "mas", label: "Más ▾" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "mas") {
                  setShowAmbientMenu(!showAmbientMenu);
                } else {
                  setActiveTab(tab.id as any);
                }
              }}
              className={`px-4.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === tab.id && tab.id !== "mas"
                  ? (isLight 
                      ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-800 border border-amber-500/35 shadow-sm"
                      : "bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border border-amber-500/30 glow-gold")
                  : (isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-slate-200")
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Dynamic Theme Manual Selector Capsule */}
        <div className={`flex p-1 rounded-full border backdrop-blur-md items-center gap-1 shadow-inner z-30 transition-all duration-500 ${
          isLight ? "bg-white/80 border-slate-200/50" : "bg-slate-900/70 border-slate-800/80"
        }`}>
          <button 
            onClick={() => {
              setActiveTheme("dawn");
              setAmbientMode("Mañana activa");
              setTemperature("23°C");
              addNotification("Ambiente cambiado", "Has seleccionado el modo 'Amanecer de Calma'", "system");
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              activeTheme === "dawn" 
                ? (isLight ? "bg-orange-500/15 text-orange-700 border border-orange-500/30 shadow-sm" : "bg-orange-500/20 text-orange-400 border border-orange-500/30") 
                : (isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200")
            }`}
            title="Amanecer de Calma (override manual)"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              setActiveTheme("day");
              setAmbientMode("Tarde productiva");
              setTemperature("22°C");
              addNotification("Ambiente cambiado", "Has seleccionado el modo 'Día Activo'", "system");
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              activeTheme === "day" 
                ? (isLight ? "bg-sky-500/15 text-sky-700 border border-sky-500/30 shadow-sm" : "bg-sky-500/20 text-sky-400 border border-sky-500/30") 
                : (isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200")
            }`}
            title="Día Activo (override manual)"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              setActiveTheme("sunset");
              setAmbientMode("Noche tranquila");
              setTemperature("21°C");
              addNotification("Ambiente cambiado", "Has seleccionado el modo 'Atardecer Atento'", "system");
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              activeTheme === "sunset" 
                ? (isLight ? "bg-rose-500/15 text-rose-700 border border-rose-500/30 shadow-sm" : "bg-rose-500/20 text-rose-400 border border-rose-500/30") 
                : (isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200")
            }`}
            title="Atardecer Cálido (override manual)"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              setActiveTheme("night");
              setAmbientMode("Noche tranquila");
              setTemperature("20°C");
              addNotification("Ambiente cambiado", "Has seleccionado el modo 'Noche Serena'", "system");
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              activeTheme === "night" 
                ? (isLight ? "bg-amber-500/15 text-amber-700 border border-amber-500/30 shadow-sm" : "bg-amber-500/20 text-amber-400 border border-amber-500/30") 
                : (isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200")
            }`}
            title="Noche Serena (override manual)"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fullscreen Option Capsule */}
        <div className={`flex p-1 rounded-full border backdrop-blur-md items-center gap-1 shadow-inner z-30 transition-all duration-500 ${
          isLight ? "bg-white/80 border-slate-200/50" : "bg-slate-900/70 border-slate-800/80"
        }`}>
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
              isFullscreen 
                ? (isLight ? "bg-amber-500/15 text-amber-700 border border-amber-500/30 shadow-sm" : "bg-amber-500/20 text-amber-400 border border-amber-500/30") 
                : (isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200")
            }`}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          
          {isInIframe && (
            <button
              onClick={handleOpenInNewTab}
              className={`p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                isLight ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
              title="Abrir en pestaña nueva (pantalla completa real)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right avatars and Family Core button */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {familyMembers.map((m) => (
              <div 
                key={m.id}
                title={m.name}
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-bold hover:scale-115 transition-transform ${getAvatarGradient(m.avatar)} ${
                  isLight ? "border-slate-200/80 shadow-sm" : "border-slate-700/80"
                }`}
              >
                {m.avatar}
              </div>
            ))}
            <button 
              onClick={() => setModals(prev => ({ ...prev, family: true }))}
              className={`w-8 h-8 rounded-full border border-dashed flex items-center justify-center hover:scale-115 transition-all cursor-pointer ${
                isLight 
                  ? "border-slate-300 hover:border-amber-500/50 bg-white/50 hover:bg-white text-amber-600" 
                  : "border-slate-700 hover:border-amber-400/50 bg-slate-900/30 hover:bg-slate-900/60 text-amber-300"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button 
            onClick={() => setModals(prev => ({ ...prev, family: true }))}
            className={`hidden sm:inline-flex py-1.5 px-4 rounded-full text-xs font-semibold border tracking-wide transition-all cursor-pointer ${
              isLight 
                ? "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 shadow-sm hover:shadow-md" 
                : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:glow-gold"
            }`}
          >
            Núcleo familiar
          </button>
        </div>
      </header>

        {/* Popover Ambient suggestions dropdown from navigation */}
        <AnimatePresence>
          {showAmbientMenu && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-1/2 -translate-x-1/2 top-18 z-40 w-48 glass-panel rounded-2xl p-2 border-amber-500/10 shadow-2xl"
            >
              <h5 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 py-1 font-mono">Cambiar Ambiente</h5>
              {[
                { mode: "Noche tranquila", temp: "21°C" },
                { mode: "Mañana activa", temp: "23°C" },
                { mode: "Tarde productiva", temp: "22°C" }
              ].map((amb) => (
                <button
                  key={amb.mode}
                  onClick={() => handleAmbientChange(amb.mode, amb.temp)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-amber-300 hover:bg-slate-900/80 transition-colors cursor-pointer"
                >
                  {amb.mode} ({amb.temp})
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Tab Body with Fade and Slide Transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="w-full flex-1 flex flex-col justify-between"
          >
            {activeTab === "inicio" && (
              <div id="tab-inicio-main" className="w-full flex-1 flex flex-col justify-between gap-4 overflow-visible z-10 my-1">
                
                {/* A. HERO PRINCIPAL CON COLUMNAS COMPLEMENTARIAS: 24% - 52% - 24% */}
                <div className="hero-section flex-1 grid grid-cols-1 lg:grid-cols-[24%_1fr_24%] xl:grid-cols-[23%_1fr_23%] gap-4 lg:gap-5 items-stretch min-h-[320px] lg:min-h-[580px] xl:min-h-[620px]">
                  {/* Columna Izquierda: 24% / 23% (Greeting + Stacked Cards 1 y 2) */}
                  <div className="flex flex-col gap-4 h-full">
                    <div className={`flex flex-col justify-between p-4.5 rounded-3xl border backdrop-blur-sm relative overflow-hidden transition-all duration-500 opacity-80 hover:opacity-100 focus-within:opacity-100 shrink-0 h-[210px] ${
                      isLight 
                        ? "bg-white/85 border-slate-200/60 shadow-sm shadow-slate-100/20" 
                        : "bg-slate-900/30 border-white/[0.03]"
                    }`}>
                      <div className="space-y-2">
                        <h2 className={`text-2xl font-extrabold font-display tracking-tight leading-tight transition-colors duration-500 ${
                          isLight ? "text-slate-900" : "text-slate-100"
                        }`}>
                          {greeting} {word}
                        </h2>
                        <h3 className={`text-lg font-bold transition-colors duration-500`} style={{ color: stateToken.primary }}>
                          {stateToken.microcopy}
                        </h3>
                        <p className={`desc-text text-xs leading-relaxed font-light mt-2 transition-colors duration-500 ${
                          isLight ? "text-slate-700" : "text-slate-300"
                        }`}>
                          {domiSubtext}
                        </p>
                        <p className={`desc-text text-[11px] font-sans italic opacity-90 leading-relaxed mt-2.5 font-medium transition-colors duration-500 ${
                          isLight ? "text-amber-800" : "text-amber-300/80"
                        }`}>
                          “Todo parte con una conversación.”
                        </p>
                      </div>

                      <div className={`flex items-center gap-2.5 p-2.5 rounded-2xl border mt-3 max-w-[240px] transition-all duration-500 ${
                        isLight 
                          ? "bg-white/95 border-amber-500/15" 
                          : "bg-slate-900/60 border-amber-500/10"
                      }`}>
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: stateToken.glow }}></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: stateToken.primary }}></span>
                        </span>
                        <div className="text-left">
                          <span className={`block text-[10px] transition-colors duration-500 font-bold uppercase tracking-wider ${
                            isLight ? "text-slate-700" : "text-slate-300"
                          }`}>Domi {domiState}</span>
                        </div>
                      </div>
                    </div>

                    {/* Left Action Cards (Cuidado and Estudio) on Desktop */}
                    <StatusCards 
                      medicineConfirmed={medicineConfirmed}
                      studyPrepared={studyPrepared}
                      shoppingItems={shoppingItems}
                      studyBlocks={studyBlocks}
                      breathingActive={breathingActive}
                      isMusicPlaying={isMusicPlaying}
                      onReviewCare={() => {
                        setModals(prev => ({ ...prev, care: true }));
                        setDomiState("esperando_confirmacion");
                      }}
                      onNotifyFamily={() => {
                        confirmMedicine(true, "Abuela (Notificado)");
                        addNotification("Notificación Familiar", "Se envió un aviso urgente confirmando cuidado de Elena.", "care");
                        setDomiState("alegre");
                        setTimeout(() => {
                          setDomiState(activeTheme === "night" ? "descanso" : "listo");
                        }, 4000);
                      }}
                      onPrepareStudy={handlePrepareStudy}
                      onViewStudyPlan={() => {
                        setModals(prev => ({ ...prev, study: true }));
                        setDomiState("proponiendo");
                      }}
                      onPrepareShopping={() => {
                        setModals(prev => ({ ...prev, shopping: true }));
                        setDomiState("proponiendo");
                      }}
                      onViewPantry={() => {
                        setModals(prev => ({ ...prev, shopping: true }));
                        setDomiState("proponiendo");
                      }}
                      onStartBreathing={() => setBreathingActive(prev => !prev)}
                      onToggleMusic={toggleMusic}
                      activeTheme={activeTheme}
                      side="left"
                      className="hidden lg:flex flex-col flex-1"
                    />
                  </div>

                  {/* Columna Central: 44% / 46% (Domi Companion - Hermosa esfera centralizada) */}
                  <div className="flex flex-col items-center justify-center relative overflow-visible h-full -translate-y-4 lg:-translate-y-8 xl:-translate-y-12">
                    <div className="domi-scale w-full flex justify-center items-center overflow-visible z-10 scale-[0.95] lg:scale-[1.0] xl:scale-[1.08] origin-center transition-all duration-300">
                      <DomiOrb 
                        medicineConfirmed={medicineConfirmed}
                        studyPrepared={studyPrepared}
                        shoppingCount={shoppingItems.filter(i => !i.checked).length}
                        breathingActive={breathingActive}
                        breathingCycle={breathingCycle}
                        onNodeClick={handleNodeClick}
                        domiMood={domiMood}
                        activeTheme={activeTheme}
                        domiState={domiState}
                        domiAppearance={domiAppearance}
                      />
                    </div>
                  </div>

                  {/* Columna Derecha: 24% / 23% (Wellness Balance + Stacked Cards 3 y 4) */}
                  <div className="flex flex-col gap-4 h-full">
                    <div className={`flex flex-col justify-between p-4.5 rounded-3xl border backdrop-blur-sm relative overflow-hidden transition-all duration-500 opacity-85 hover:opacity-100 focus-within:opacity-100 shrink-0 h-[210px] ${
                      isLight 
                        ? "bg-white/85 border-slate-200/60 shadow-sm shadow-slate-100/20" 
                        : "bg-slate-900/30 border-white/[0.03]"
                    }`}>
                      <div className="space-y-3.5">
                        <div>
                          <h4 className={`text-sm font-bold tracking-tight transition-colors duration-500 ${
                            isLight ? "text-slate-900" : "text-slate-100"
                          }`}>Tu hogar hoy</h4>
                          <span className={`text-[10px] font-semibold tracking-wider uppercase transition-colors duration-500 opacity-70 ${
                            isLight ? "text-amber-800" : "text-amber-300"
                          }`}>Cuidado · Estudio · Compras</span>
                        </div>

                        <div className="space-y-1.5">
                          <span className={`block text-[11px] font-semibold transition-colors duration-500 ${
                            isLight ? "text-slate-700" : "text-slate-300"
                          }`}>3 cosas importantes:</span>
                          <ul className={`text-[11px] space-y-1 font-medium leading-relaxed transition-colors duration-500 ${
                            isLight ? "text-slate-600" : "text-slate-300/95"
                          }`}>
                            <li className="flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                              <span>Medicamento de Elena {medicineConfirmed ? "(Listo)" : "(Pendiente)"}</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                              <span>Prueba de Diego {studyPrepared ? "(Listo)" : "(Pendiente)"}</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                              <span>Compras por organizar ({shoppingItems.filter(i => !i.checked).length})</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setModals(prev => ({ ...prev, summary: true }));
                          setDomiState("proponiendo");
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer mt-3 ${
                          isLight 
                            ? "bg-amber-100 hover:bg-amber-200/80 text-amber-800 border-amber-300 shadow-sm" 
                            : "bg-slate-950/40 hover:bg-slate-950/70 text-amber-200 hover:text-amber-100 border border-amber-500/10 hover:border-amber-500/20"
                        }`}
                      >
                        <span>Ver resumen del día</span>
                        <span className="text-xs">→</span>
                      </button>
                    </div>

                    {/* Right Action Cards (Compras and Calma) on Desktop */}
                    <StatusCards 
                      medicineConfirmed={medicineConfirmed}
                      studyPrepared={studyPrepared}
                      shoppingItems={shoppingItems}
                      studyBlocks={studyBlocks}
                      breathingActive={breathingActive}
                      isMusicPlaying={isMusicPlaying}
                      onReviewCare={() => {
                        setModals(prev => ({ ...prev, care: true }));
                        setDomiState("esperando_confirmacion");
                      }}
                      onNotifyFamily={() => {
                        confirmMedicine(true, "Abuela (Notificado)");
                        addNotification("Notificación Familiar", "Se envió un aviso urgente confirmando cuidado de Elena.", "care");
                        setDomiState("alegre");
                        setTimeout(() => {
                          setDomiState(activeTheme === "night" ? "descanso" : "listo");
                        }, 4000);
                      }}
                      onPrepareStudy={handlePrepareStudy}
                      onViewStudyPlan={() => {
                        setModals(prev => ({ ...prev, study: true }));
                        setDomiState("proponiendo");
                      }}
                      onPrepareShopping={() => {
                        setModals(prev => ({ ...prev, shopping: true }));
                        setDomiState("proponiendo");
                      }}
                      onViewPantry={() => {
                        setModals(prev => ({ ...prev, shopping: true }));
                        setDomiState("proponiendo");
                      }}
                      onStartBreathing={() => setBreathingActive(prev => !prev)}
                      onToggleMusic={toggleMusic}
                      activeTheme={activeTheme}
                      side="right"
                      className="hidden lg:flex flex-col flex-1"
                    />
                  </div>
                </div>

                {/* B. CARDS PRINCIPALES (Solo visible en móviles/tablets para no duplicar en escritorio) */}
                <div id="tab-inicio-action-cards" className="w-full z-10 shrink-0 lg:hidden">
                  <StatusCards 
                    medicineConfirmed={medicineConfirmed}
                    studyPrepared={studyPrepared}
                    shoppingItems={shoppingItems}
                    studyBlocks={studyBlocks}
                    breathingActive={breathingActive}
                    isMusicPlaying={isMusicPlaying}
                    onReviewCare={() => {
                      setModals(prev => ({ ...prev, care: true }));
                      setDomiState("esperando_confirmacion");
                    }}
                    onNotifyFamily={() => {
                      confirmMedicine(true, "Abuela (Notificado)");
                      addNotification("Notificación Familiar", "Se envió un aviso urgente confirmando cuidado de Elena.", "care");
                      setDomiState("alegre");
                      setTimeout(() => {
                        setDomiState(activeTheme === "night" ? "descanso" : "listo");
                      }, 4000);
                    }}
                    onPrepareStudy={handlePrepareStudy}
                    onViewStudyPlan={() => {
                      setModals(prev => ({ ...prev, study: true }));
                      setDomiState("proponiendo");
                    }}
                    onPrepareShopping={() => {
                      setModals(prev => ({ ...prev, shopping: true }));
                      setDomiState("proponiendo");
                    }}
                    onViewPantry={() => {
                      setModals(prev => ({ ...prev, shopping: true }));
                      setDomiState("proponiendo");
                    }}
                    onStartBreathing={() => setBreathingActive(prev => !prev)}
                    onToggleMusic={toggleMusic}
                    activeTheme={activeTheme}
                    side="all"
                  />
                </div>

                {/* C. DOCK DE VOZ & MINI CARDS FLANQUEADORAS */}
                <div className="grid grid-cols-1 lg:grid-cols-[24%_1fr_24%] xl:grid-cols-[23%_1fr_23%] gap-4 lg:gap-5 items-center w-full z-20 mt-1 pb-1 -translate-y-2.5 md:-translate-y-5 lg:-translate-y-7 xl:-translate-y-10">
                  
                  {/* Left Mini Card: Ambiente sugerido */}
                  <div className={`bottom-mini-card lg:col-span-1 flex items-center gap-3 p-3 rounded-2xl border backdrop-blur-md shadow-lg h-[64px] transition-all duration-500 ${
                    isLight ? "bg-white/45 border-white/60 shadow-slate-200/30" : "bg-slate-900/40 border-white/[0.03]"
                  }`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                      isLight ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      <Moon className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left truncate">
                      <span className={`block text-[8px] font-bold uppercase tracking-wider font-mono ${isLight ? "text-slate-400" : "text-slate-500"}`}>Ambiente sugerido</span>
                      <h5 className={`text-xs font-bold truncate font-sans ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                        {activeTheme === "dawn" ? "Despertar suave" : activeTheme === "day" ? "Día luminoso" : activeTheme === "sunset" ? "Atardecer cálido" : "Noche tranquila"}
                      </h5>
                      <span className={`block text-[9px] font-mono mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>{time} · {temperature}</span>
                    </div>
                  </div>

                  {/* Center Dock de voz principal */}
                  <div className="voice-dock-container lg:col-span-1 w-full flex flex-col items-center justify-center relative">
                    
                    {/* Subtle state-dependent light beam connecting Domi with the voice dock */}
                    <div 
                      className="hidden lg:block absolute bottom-full left-1/2 -translate-x-1/2 w-[1px] h-[36px] pointer-events-none z-0 transition-all duration-700"
                      style={{
                        background: `linear-gradient(to bottom, transparent, ${stateToken.primary}44, ${stateToken.primary})`
                      }}
                    >
                      {/* Luminous pulse travelling up and down */}
                      <div 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[3px] h-[8px] rounded-full opacity-80 animate-pulse transition-all duration-700" 
                        style={{
                          backgroundColor: stateToken.glow,
                          boxShadow: `0 0 8px ${stateToken.primary}`
                        }}
                      />
                    </div>

                    <DomiChat 
                      messages={chatMessages}
                      isListening={isListening}
                      isSending={isSending}
                      onSendMessage={sendMessageToDomi}
                      onToggleListening={triggerListeningSimulation}
                      onAddSystemNotification={addNotification}
                      onSimulateAction={executeAIAction}
                      activeTheme={activeTheme}
                    />
                  </div>

                  {/* Right Mini Card: Cuidado diario */}
                  <div className={`bottom-mini-card lg:col-span-1 flex items-center justify-between p-3 rounded-2xl border backdrop-blur-md shadow-lg h-[64px] transition-all duration-500 ${
                    isLight ? "bg-white/45 border-white/60 shadow-slate-200/30" : "bg-slate-900/40 border-white/[0.03]"
                  }`}>
                    <div className="flex items-center gap-3 truncate">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                        isLight ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        <ShieldCheck className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-left truncate">
                        <span className={`block text-[8px] font-bold uppercase tracking-wider font-mono ${isLight ? "text-slate-400" : "text-slate-500"}`}>Cuidado diario</span>
                        <h5 className={`text-xs font-bold truncate font-sans ${isLight ? "text-slate-700" : "text-slate-200"}`}>Hogar en armonía</h5>
                        <span className={`block text-[9px] font-mono mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>Conexión Domi</span>
                      </div>
                    </div>
                    <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse shrink-0 ml-1" />
                  </div>

                </div>

              </div>
            )}

            {activeTab === "hoy" && (
              <div id="tab-hoy-container" className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-start z-10 flex-1 my-2">
                {/* Column 1: Elena Care and Health */}
                <div id="hoy-col-elena" className={`p-5 rounded-3xl border backdrop-blur-md space-y-4 shadow-xl h-full flex flex-col justify-between transition-all duration-500 ${
                  isLight ? "bg-white/85 border-slate-200/60 shadow-sm" : "bg-slate-900/40 border-slate-800/80"
                }`}>
                  <div className="space-y-4">
                    <div className={`flex items-center gap-3 pb-3 border-b ${isLight ? "border-slate-200/60" : "border-slate-800/60"}`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        <Heart className="w-5 h-5 text-rose-500" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold font-display ${isLight ? "text-slate-900" : "text-slate-100"}`}>Cuidado & Salud</h3>
                        <span className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? "text-slate-500 font-semibold" : "text-slate-400"}`}>Elena (Abuela)</span>
                      </div>
                    </div>

                    <div className={`p-3.5 rounded-2xl border ${isLight ? "bg-slate-50/80 border-slate-200/60 shadow-inner" : "bg-slate-950/40 border-slate-800/60"} space-y-2.5`}>
                      <div className="flex justify-between items-center text-xs">
                        <span className={isLight ? "text-slate-600 font-medium" : "text-slate-400"}>Estado general</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 uppercase">
                          Estable
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={isLight ? "text-slate-600 font-medium" : "text-slate-400"}>Toma de Metformina</span>
                        <span className={`font-mono font-medium ${isLight ? "text-slate-800" : "text-slate-300"}`}>21:30</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className={`text-[9px] font-bold uppercase tracking-widest font-mono ${isLight ? "text-slate-500" : "text-slate-500"}`}>Control de hoy</span>
                      <button
                        onClick={() => confirmMedicine(!medicineConfirmed)}
                        className={`w-full py-3 px-4 rounded-2xl font-semibold text-xs border transition-all flex items-center justify-between cursor-pointer ${
                          medicineConfirmed 
                            ? (isLight ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100/60" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15")
                            : (isLight ? "bg-amber-50 border-amber-300 text-amber-800 animate-pulse hover:bg-amber-100/60" : "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse hover:bg-amber-500/15")
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Heart className={`w-4 h-4 ${medicineConfirmed ? "text-emerald-500 animate-pulse" : "text-amber-500"}`} />
                          Medicamento nocturno
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-mono font-bold ${isLight ? "bg-slate-100 text-slate-700" : "bg-slate-950/60"}`}>
                          {medicineConfirmed ? "CONFIRMADA" : "PENDIENTE"}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className={`text-[9px] font-bold uppercase tracking-widest font-mono ${isLight ? "text-slate-500" : "text-slate-500"}`}>Bitácora médica</span>
                      {medicineLogs.length === 0 ? (
                        <div className={`p-3.5 rounded-2xl border border-dashed text-center text-xs italic ${
                          isLight ? "bg-slate-50/50 border-slate-200 text-slate-500" : "bg-slate-950/20 border-slate-800/60 text-slate-400"
                        }`}>
                          No hay registros de tomas para hoy.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                          {medicineLogs.map((log, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] ${
                              isLight ? "bg-white border-slate-200 text-slate-700" : "bg-slate-950/40 border-slate-800/50 text-slate-300"
                            }`}>
                              <span className="font-semibold">Dosis Confirmada</span>
                              <span className="font-mono text-[10px]">{log.time} • {log.confirmedBy}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`mt-4 p-3 rounded-2xl border text-center ${isLight ? "bg-slate-100/60 border-slate-200/50" : "bg-slate-950/40 border-slate-800/30"}`}>
                    <span className={`text-[10px] ${isLight ? "text-slate-600 font-medium" : "text-slate-400"}`}>Última actualización de telemetría hace 3 min</span>
                  </div>
                </div>

                {/* Column 2: Diego Study Plan & Pomodoro */}
                <div id="hoy-col-diego" className={`p-5 rounded-3xl border backdrop-blur-md space-y-4 shadow-xl h-full flex flex-col justify-between transition-all duration-500 ${
                  isLight ? "bg-white/85 border-slate-200/60 shadow-sm" : "bg-slate-900/40 border-slate-800/80"
                }`}>
                  <div className="space-y-4">
                    <div className={`flex items-center gap-3 pb-3 border-b ${isLight ? "border-slate-200/60" : "border-slate-800/60"}`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-500 border border-sky-500/20">
                        <BookOpen className="w-5 h-5 text-sky-500" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold font-display ${isLight ? "text-slate-900" : "text-slate-100"}`}>Estudio & Enfoque</h3>
                        <span className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? "text-slate-500 font-semibold" : "text-slate-400"}`}>Diego (Estudiante)</span>
                      </div>
                    </div>

                    {/* Integrated Study Timer */}
                    <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-3 relative overflow-hidden transition-all duration-500 ${
                      isLight ? "bg-slate-50/80 border-slate-200/60 shadow-inner" : "bg-slate-950/40 border-slate-800/60"
                    }`}>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />
                      <span className={`text-[9px] font-bold uppercase tracking-widest font-mono ${isLight ? "text-sky-700" : "text-sky-400"}`}>
                        {studyActiveBlockId ? `Enfoque: ${studyBlocks.find(b => b.id === studyActiveBlockId)?.subject}` : "Temporizador de Enfoque"}
                      </span>
                      <div className={`text-3xl font-mono font-bold tracking-widest ${
                        studyTimerActive 
                          ? (isLight ? "text-amber-600 animate-pulse" : "text-amber-400 animate-pulse") 
                          : (isLight ? "text-slate-800" : "text-slate-300")
                      }`}>
                        {formatTime(studyTimeLeft)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setStudyTimerActive(!studyTimerActive)}
                          className={`py-1.5 px-4 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                            studyTimerActive 
                              ? "bg-red-500/20 border border-red-500/35 text-red-600 hover:bg-red-500/30" 
                              : "bg-sky-500/20 border border-sky-500/35 text-sky-600 hover:bg-sky-500/30"
                          }`}
                        >
                          {studyTimerActive ? "Pausar" : "Iniciar"}
                        </button>
                        <button
                          onClick={() => {
                            setStudyTimerActive(false);
                            setStudyTimeLeft(2700);
                          }}
                          className={`p-1.5 rounded-full border cursor-pointer transition-all ${
                            isLight 
                              ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 shadow-sm" 
                              : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                          }`}
                          title="Reiniciar"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-bold uppercase tracking-widest font-mono ${isLight ? "text-slate-500" : "text-slate-500"}`}>Bloques de Hoy</span>
                        <button
                          onClick={handlePrepareStudy}
                          className={`text-[10px] font-semibold cursor-pointer ${isLight ? "text-amber-700 hover:text-amber-800" : "text-amber-400 hover:text-amber-300"}`}
                        >
                          Estructurar Plan
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {studyBlocks.map((block) => (
                          <div 
                            key={block.id}
                            onClick={() => {
                              setStudyActiveBlockId(block.id);
                              setStudyTimeLeft(block.duration.includes("45") ? 2700 : 1800);
                              setStudyTimerActive(false);
                            }}
                            className={`p-2.5 rounded-xl border text-xs text-left cursor-pointer transition-all flex items-center justify-between ${
                              studyActiveBlockId === block.id
                                ? (isLight ? "bg-sky-50 border-sky-300 text-sky-800 shadow-sm" : "bg-sky-500/10 border-sky-500/40 text-sky-200")
                                : (isLight ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-slate-950/20 border-slate-800/40 text-slate-300 hover:bg-slate-950/40")
                            }`}
                          >
                            <div>
                              <strong className="block font-medium">{block.subject}</strong>
                              <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>{block.time} • {block.duration}</span>
                            </div>
                            <span className={`text-[9px] font-mono font-bold py-0.5 px-2 rounded-md uppercase ${
                              isLight ? "bg-slate-100 text-slate-700" : "bg-slate-950/60"
                            }`}>
                              {studyPrepared ? "Organizado" : "Pendiente"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`mt-4 p-3 rounded-2xl border text-center ${isLight ? "bg-slate-100/60 border-slate-200/50" : "bg-slate-950/40 border-slate-800/30"}`}>
                    <span className={`text-[10px] ${isLight ? "text-slate-600 font-medium" : "text-slate-400"}`}>Haz clic en un bloque para asignarlo al cronómetro</span>
                  </div>
                </div>

                {/* Column 3: Grocery list and Despensa */}
                <div id="hoy-col-despensa" className={`p-5 rounded-3xl border backdrop-blur-md space-y-4 shadow-xl h-full flex flex-col justify-between transition-all duration-500 ${
                  isLight ? "bg-white/85 border-slate-200/60 shadow-sm" : "bg-slate-900/40 border-slate-800/80"
                }`}>
                  <div className="space-y-4">
                    <div className={`flex items-center gap-3 pb-3 border-b ${isLight ? "border-slate-200/60" : "border-slate-800/60"}`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <ShoppingCart className="w-5 h-5 text-amber-550" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold font-display ${isLight ? "text-slate-900" : "text-slate-100"}`}>Despensa Familiar</h3>
                        <span className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? "text-slate-500 font-semibold" : "text-slate-400"}`}>
                          {shoppingItems.filter(i => !i.checked).length} pendientes
                        </span>
                      </div>
                    </div>

                    {/* Simple Quick Add Item */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const name = formData.get("item-name") as string;
                        if (name && name.trim()) {
                          handleAddShoppingItem(name);
                          e.currentTarget.reset();
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input 
                        name="item-name"
                        type="text" 
                        placeholder="Añadir artículo rápido..."
                        className={`flex-1 focus:border-amber-500/40 rounded-xl px-3 py-1.5 text-xs focus:outline-none placeholder-slate-550 transition-all ${
                          isLight 
                            ? "bg-slate-100 border border-slate-200 text-slate-800" 
                            : "bg-slate-950/60 border border-slate-800 text-slate-100"
                        }`}
                      />
                      <button 
                        type="submit"
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 p-1.5 rounded-xl cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </form>

                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                      {shoppingItems.map((item) => (
                        <div 
                          key={item.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                            isLight 
                              ? "bg-white border-slate-200 text-slate-700" 
                              : "bg-slate-950/20 border-slate-800/30 text-slate-300"
                          }`}
                        >
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                            <input 
                              type="checkbox" 
                              checked={item.checked}
                              onChange={() => handleToggleShoppingItem(item.id)}
                              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 bg-transparent cursor-pointer"
                            />
                            <span className={`text-xs ${item.checked ? "line-through text-slate-400" : (isLight ? "text-slate-800 font-semibold" : "text-slate-200 font-medium")}`}>
                              {item.name}
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isLight ? "text-slate-750 bg-slate-100" : "text-slate-500 bg-slate-950/40"}`}>{item.qty}</span>
                            <button 
                              onClick={() => handleDeleteShoppingItem(item.id)}
                              className="text-slate-500 hover:text-red-500 p-0.5 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setShoppingItems(prev => prev.filter(i => !i.checked));
                      addNotification("Lista de compras limpia", "Se han removido los artículos ya comprados de la lista.", "shopping");
                    }}
                    className={`w-full mt-4 py-2 text-[11px] font-semibold rounded-xl border cursor-pointer transition-all ${
                      isLight 
                        ? "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200 shadow-sm" 
                        : "bg-slate-950/60 hover:bg-slate-950 text-slate-400 hover:text-slate-300 border border-slate-850"
                    }`}
                  >
                    Eliminar artículos comprados
                  </button>
                </div>
              </div>
            )}

            {activeTab === "documentos" && (
              <div id="tab-documentos-container" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start z-10 flex-1 my-2">
                {/* Left controls sidebar */}
                <div id="documentos-sidebar" className={`lg:col-span-4 p-5 rounded-3xl border backdrop-blur-md space-y-4 shadow-xl transition-all duration-500 ${
                  isLight 
                    ? "bg-white/85 border-slate-200/60 shadow-sm" 
                    : "bg-slate-900/40 border-slate-800/80"
                }`}>
                  <div className={`flex items-center gap-3 pb-3 border-b ${
                    isLight ? "border-slate-200/60" : "border-slate-800/60"
                  }`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Folder className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className={`text-base font-bold font-display ${isLight ? "text-slate-900" : "text-slate-100"}`}>Documentos</h3>
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Repositorio del Hogar</span>
                    </div>
                  </div>

                  {/* Filter pills vertical */}
                  <div className="space-y-1">
                    <span className={`text-[9px] font-bold uppercase tracking-widest font-mono block mb-1 ${isLight ? "text-slate-400" : "text-slate-500"}`}>Categorías</span>
                    {[
                      { id: "todos", label: "Todos los archivos", count: documents.length },
                      { id: "salud", label: "Salud & Recetas", count: documents.filter(d => d.category === "salud").length },
                      { id: "educacion", label: "Educación & Notas", count: documents.filter(d => d.category === "educacion").length },
                      { id: "hogar", label: "Hogar & Manuales", count: documents.filter(d => d.category === "hogar").length },
                      { id: "recetas", label: "Recetas Familiares", count: documents.filter(d => d.category === "recetas").length }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedDocCategory(cat.id as any)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                          selectedDocCategory === cat.id
                            ? (isLight 
                                ? "bg-amber-500/10 border border-amber-500/30 text-amber-800 shadow-sm" 
                                : "bg-amber-500/15 border border-amber-500/30 text-amber-300")
                            : (isLight 
                                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" 
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/20")
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isLight 
                            ? "text-slate-500 bg-slate-100/80" 
                            : "text-slate-500 bg-slate-950/40"
                        }`}>{cat.count}</span>
                      </button>
                    ))}
                  </div>

                  {/* Upload zone Simulation */}
                  <div className="space-y-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest font-mono block ${isLight ? "text-slate-400" : "text-slate-500"}`}>Subir Documento</span>
                    <div 
                      onClick={() => {
                        const randomFiles = [
                          { name: "Recibo de Agua Julio.pdf", category: "hogar", size: "1.1 MB" },
                          { name: "Receta Oftalmológica Elena.pdf", category: "salud", size: "450 KB" },
                          { name: "Temario Examen Diego.pdf", category: "educacion", size: "2.3 MB" },
                          { name: "Receta Pastel de Choclo.pdf", category: "recetas", size: "780 KB" }
                        ];
                        const random = randomFiles[Math.floor(Math.random() * randomFiles.length)];
                        handleSimulatedUpload(random.name, random.category as any, random.size);
                      }}
                      className={`border-2 border-dashed p-5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-2 group ${
                        isLight 
                          ? "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 hover:border-amber-500/50" 
                          : "border-slate-800 hover:border-amber-400/50 bg-slate-950/30 hover:bg-slate-950/60"
                      }`}
                    >
                      <UploadCloud className={`w-8 h-8 transition-colors ${isLight ? "text-slate-400 group-hover:text-amber-600" : "text-slate-500 group-hover:text-amber-400"}`} />
                      <div>
                        <span className={`block text-xs font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>Presiona aquí para simular subida</span>
                        <span className={`block text-[10px] mt-1 ${isLight ? "text-slate-400" : "text-slate-500"}`}>Generará un archivo aleatorio</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right files list */}
                <div id="documentos-files-list" className={`lg:col-span-8 p-5 rounded-3xl border backdrop-blur-md space-y-4 shadow-xl transition-all duration-500 ${
                  isLight 
                    ? "bg-white/85 border-slate-200/60 shadow-sm" 
                    : "bg-slate-900/40 border-slate-800/80"
                }`}>
                  {/* Search bar inside right side */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className={`h-4 w-4 ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                    </span>
                    <input 
                      type="text" 
                      placeholder="Buscar documentos por nombre..."
                      value={documentSearch}
                      onChange={(e) => setDocumentSearch(e.target.value)}
                      className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-xs transition-all focus:outline-none ${
                        isLight 
                          ? "bg-slate-50/90 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-amber-500/30" 
                          : "bg-slate-950/60 border-slate-800 text-slate-100 placeholder-slate-500 focus:border-amber-500/40"
                      }`}
                    />
                  </div>

                  {/* Document Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
                    {documents
                      .filter(d => selectedDocCategory === "todos" || d.category === selectedDocCategory)
                      .filter(d => d.name.toLowerCase().includes(documentSearch.toLowerCase()))
                      .length === 0 ? (
                        <div className={`col-span-2 p-10 text-center text-xs italic ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                          No se encontraron documentos que coincidan con la búsqueda.
                        </div>
                      ) : (
                        documents
                          .filter(d => selectedDocCategory === "todos" || d.category === selectedDocCategory)
                          .filter(d => d.name.toLowerCase().includes(documentSearch.toLowerCase()))
                          .map((doc) => {
                            const categoryColors = {
                              salud: isLight 
                                ? "from-rose-500/5 to-transparent border-rose-200/80 text-rose-600" 
                                : "from-rose-500/10 to-transparent border-rose-500/20 text-rose-400",
                              educacion: isLight 
                                ? "from-sky-500/5 to-transparent border-sky-200/80 text-sky-600" 
                                : "from-sky-500/10 to-transparent border-sky-500/20 text-sky-400",
                              hogar: isLight 
                                ? "from-amber-500/5 to-transparent border-amber-200/80 text-amber-700" 
                                : "from-amber-500/10 to-transparent border-amber-500/20 text-amber-400",
                              recetas: isLight 
                                ? "from-emerald-500/5 to-transparent border-emerald-200/80 text-emerald-600" 
                                : "from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400",
                            };
                            return (
                              <div 
                                key={doc.id}
                                className={`p-4 rounded-2xl bg-gradient-to-br ${categoryColors[doc.category]} border flex flex-col justify-between space-y-3 hover:shadow-lg transition-all hover:scale-[1.01] ${
                                  isLight ? "bg-white/80 border-slate-200/60" : "bg-slate-950/20 border-white/[0.03]"
                                }`}
                              >
                                <div className="flex gap-3 items-start">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isLight ? "bg-slate-100/80 text-slate-600" : "bg-slate-950/60 text-slate-300"
                                  }`}>
                                    <FileText className="w-4.5 h-4.5" />
                                  </div>
                                  <div className="text-left">
                                    <strong className={`text-xs font-semibold block truncate max-w-[180px] ${isLight ? "text-slate-800" : "text-slate-200"}`} title={doc.name}>
                                      {doc.name}
                                    </strong>
                                    <span className={`text-[10px] font-mono block mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>{doc.size} • {doc.date}</span>
                                  </div>
                                </div>

                                <div className={`flex items-center justify-between pt-2 border-t ${isLight ? "border-slate-100" : "border-slate-800/50"}`}>
                                  <span className={`text-[10px] font-medium ${isLight ? "text-slate-450" : "text-slate-500"}`}>Subido por {doc.uploader}</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleSimulatedDownload(doc.name)}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                        isLight 
                                          ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-amber-600" 
                                          : "border-slate-800/80 bg-slate-900/60 text-slate-400 hover:text-amber-300"
                                      }`}
                                      title="Descargar archivo"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDocument(doc.id)}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                        isLight 
                                          ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-red-500" 
                                          : "border-slate-800/80 bg-slate-900/60 text-slate-400 hover:text-red-400"
                                      }`}
                                      title="Eliminar archivo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Visual Pagination dots from reference image centered below action cards */}
        <div className="flex justify-center gap-1.5 z-10 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700/80" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700/80" />
        </div>

      {/* Drawer Button for Notifications */}
      <button 
        onClick={() => setShowNotifications(true)}
        className="fixed bottom-6 right-6 z-40 bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-400 p-3.5 rounded-full border border-slate-800 shadow-2xl flex items-center justify-center group/bell hover:glow-gold"
      >
        <Bell className="w-5 h-5 group-hover/bell:animate-bounce" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
          {notifications.length}
        </span>
      </button>

      {/* 5. AUDIT LOGS / NOTIFICATIONS SIDE DRAWER */}
      <AnimatePresence>
        {showNotifications && (
          <div className={`fixed inset-0 z-50 flex justify-end backdrop-blur-sm transition-all duration-300 ${
            isLight ? "bg-slate-900/10" : "bg-slate-950/40"
          }`}>
            {/* Backdrop click closer */}
            <div className="absolute inset-0" onClick={() => setShowNotifications(false)} />
            
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className={`relative w-full max-w-sm h-full p-6 flex flex-col justify-between border-l backdrop-blur-md shadow-2xl transition-all duration-500 ${
                isLight ? "bg-white/95 border-slate-200/80" : "glass-panel border-slate-800"
              }`}
            >
              <div>
                <div className={`flex items-center justify-between border-b pb-4 mb-4 ${
                  isLight ? "border-slate-150" : "border-slate-800"
                }`}>
                  <h3 className={`text-base font-bold font-display flex items-center gap-2 ${
                    isLight ? "text-slate-900" : "text-slate-100"
                  }`}>
                    <Bell className="w-4 h-4 text-amber-400" />
                    Bitácora de Eventos
                  </h3>
                  <button onClick={() => setShowNotifications(false)} className={`p-1 transition-colors ${
                    isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-400 hover:text-slate-200"
                  }`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[80vh] pr-1 no-scrollbar">
                  {notifications.map((notif) => (
                    <div key={notif.id} className={`p-3 rounded-xl border text-xs transition-all ${
                      isLight 
                        ? "bg-slate-50 border-slate-200/80 shadow-sm text-slate-800" 
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                    }`}>
                      <div className="flex justify-between items-start mb-1">
                        <strong className={`block font-semibold ${isLight ? "text-slate-850" : "text-slate-200"}`}>{notif.title}</strong>
                        <span className={`text-[9px] font-mono ${isLight ? "text-slate-450" : "text-slate-500"}`}>{notif.timestamp}</span>
                      </div>
                      <p className={`${isLight ? "text-slate-600" : "text-slate-400"} leading-relaxed`}>{notif.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setNotifications([])}
                className={`w-full py-2 text-xs font-semibold rounded-xl border transition-all ${
                  isLight 
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-sm" 
                    : "bg-slate-950/60 hover:bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-900"
                }`}
              >
                Limpiar historial de eventos
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODALS ROOT ELEMENT */}
      <Modals 
        activeTheme={activeTheme}
        showCare={modals.care}
        showStudy={modals.study}
        showShopping={modals.shopping}
        showFamily={modals.family}
        showSummary={modals.summary}
        medicineConfirmed={medicineConfirmed}
        studyPrepared={studyPrepared}
        shoppingItems={shoppingItems}
        studyBlocks={studyBlocks}
        familyMembers={familyMembers}
        medicineLogs={medicineLogs}
        onCloseAll={() => {
          setModals({ care: false, study: false, shopping: false, family: false, summary: false });
          if (["proponiendo", "esperando_confirmacion", "pensando"].includes(domiState)) {
            setDomiState(activeTheme === "night" ? "descanso" : "listo");
          }
        }}
        onConfirmMedicine={confirmMedicine}
        onToggleShoppingItem={handleToggleShoppingItem}
        onAddShoppingItem={handleAddShoppingItem}
        onDeleteShoppingItem={handleDeleteShoppingItem}
        onUpdateFamilyStatus={handleUpdateFamilyStatus}
        onPrepareStudy={handlePrepareStudy}
      />

      {/* 5. INTERACTIVE DOMI LAB & STATE SWITCHER */}
      {devModeActive && (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
          {/* Collapsible Panel with AnimatePresence */}
          <AnimatePresence>
            {devPanelOpen && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl w-[340px] max-w-[90vw] transition-all duration-300 ${
                  isLight ? "bg-white/95 border-slate-200/90 shadow-slate-200 text-slate-800" : "bg-slate-950/95 border-slate-800/90 shadow-black text-slate-200"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-2.5 pb-1.5 border-b border-white/[0.05]">
                  <div className="flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4 text-amber-500 animate-pulse" />
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider font-mono opacity-90 block">
                        Domi Lab ✨
                      </span>
                      <span className="text-[9px] font-mono opacity-50 block">Personalización & Estados</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono opacity-45 uppercase border border-white/[0.05] px-1 rounded">Ctrl+Shift+D</span>
                    <button 
                      onClick={() => setDevPanelOpen(false)}
                      className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Themes Grid */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider font-mono opacity-60 block mb-1">
                      A. Ambiente del Hogar
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {(["dawn", "day", "sunset", "night"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setActiveTheme(t);
                            if (t === "dawn") {
                              setAmbientMode("Mañana activa");
                              setTemperature("23°C");
                            } else if (t === "day") {
                              setAmbientMode("Tarde productiva");
                              setTemperature("22°C");
                            } else if (t === "sunset") {
                              setAmbientMode("Atardecer cálido");
                              setTemperature("21°C");
                            } else {
                              setAmbientMode("Noche tranquila");
                              setTemperature("20°C");
                            }
                            addNotification("Ambiente cambiado", `Has cambiado al ambiente '${t}'`, "system");
                          }}
                          className={`px-1.5 py-1 rounded text-[9px] font-mono transition-all border cursor-pointer text-center capitalize ${
                            activeTheme === t
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold"
                              : "bg-white/[0.02] border-white/[0.05] opacity-60 hover:opacity-100"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* States Grid */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider font-mono opacity-60 block mb-1">
                      B. Estado de Ánimo / Intención
                    </span>
                    <div className="grid grid-cols-2 gap-1 max-h-[120px] overflow-y-auto no-scrollbar">
                      {(Object.keys(domiStateTokens) as DomiState[]).map((st) => {
                        const tok = domiStateTokens[st];
                        const isActive = domiState === st;
                        return (
                          <button
                            key={st}
                            onClick={() => {
                              setDomiState(st);
                              addNotification("Estado cambiado", `Domi ahora está en modo '${st}'`, "system");
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-left transition-all border cursor-pointer ${
                              isActive
                                ? "bg-amber-500/15 border-amber-500/30 font-bold text-amber-400"
                                : "bg-white/[0.02] border-transparent opacity-70 hover:opacity-100"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: tok.primary }} />
                            <span className="truncate capitalize">{st.replace("_", " ")}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Appearance Grid */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider font-mono opacity-60 block mb-1">
                      C. Disfraces y Aspectos
                    </span>
                    <div className="grid grid-cols-2 gap-1 max-h-[150px] overflow-y-auto no-scrollbar">
                      {[
                        { id: "original", label: "Original", icon: Sparkles },
                        { id: "estudio", label: "Estudio", icon: BookOpen },
                        { id: "calma", label: "Calma 🧘", icon: Compass },
                        { id: "protector", label: "Protector 🛡️", icon: ShieldCheck },
                        { id: "chef", label: "Chef 🍳", icon: ChefHat },
                        { id: "astronaut", label: "Astronauta 🚀", icon: Rocket },
                        { id: "detective", label: "Detective 🔍", icon: Search },
                        { id: "wizard", label: "Mago 🧙‍♂️", icon: Wand2 },
                        { id: "cercano", label: "Cercano", icon: ChefHat },
                        { id: "noche", label: "Noche", icon: Moon },
                        { id: "senior", label: "Sénior", icon: CheckCircle }
                      ].map((cos) => {
                        const CostumeIcon = cos.icon;
                        const isActive = domiAppearance === cos.id;
                        return (
                          <button
                            key={cos.id}
                            onClick={() => {
                              setDomiAppearance(cos.id as any);
                              addNotification("Apariencia cambiada", `Domi ahora viste su traje de ${cos.label}!`, "system");
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-left transition-all border cursor-pointer ${
                              isActive
                                ? "bg-amber-500/15 border-amber-500/30 font-bold text-amber-400"
                                : "bg-white/[0.02] border-transparent opacity-70 hover:opacity-100"
                            }`}
                          >
                            <CostumeIcon className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{cos.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Discreet floating trigger button */}
          <button
            onClick={() => setDevPanelOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer text-[10px] font-medium ${
              devPanelOpen
                ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                : isLight
                  ? "bg-white/90 hover:bg-white border-slate-200 text-slate-600 hover:text-slate-800"
                  : "bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Domi Lab — panel de QA visual (solo dev=1 / Ctrl+Shift+D). No es una función del usuario."
          >
            <Wand2 className={`w-3.5 h-3.5 ${devPanelOpen ? "text-amber-500 animate-pulse" : "text-amber-400"}`} />
            <span>Domi Lab · QA (dev)</span>
          </button>
        </div>
      )}

    </div>
  );
}
