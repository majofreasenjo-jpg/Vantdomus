"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "./domiMotion";
import { 
  Heart, 
  ShoppingCart, 
  BookOpen, 
  Mail, 
  Settings, 
  Waves, 
  Sparkles 
} from "lucide-react";

import { DomiState, domiStateTokens } from "./domiTypes";

interface DomiOrbProps {
  medicineConfirmed: boolean;
  studyPrepared: boolean;
  shoppingCount: number;
  breathingActive: boolean;
  breathingCycle: "inhale" | "hold" | "exhale" | "idle";
  onNodeClick: (nodeType: string) => void;
  domiMood: "happy" | "speaking" | "breathing" | "thinking";
  activeTheme?: "dawn" | "day" | "sunset" | "night";
  domiState?: DomiState;
  domiAppearance?: string;
  /** OPS-1 "partir limpio": en hogar real, los nodos no muestran badges de
   * ejemplo (Salud 1, Mensajes 3, Examen). */
  isReal?: boolean;
}

export default function DomiOrb({
  medicineConfirmed,
  studyPrepared,
  shoppingCount,
  breathingActive,
  breathingCycle,
  onNodeClick,
  domiMood,
  activeTheme = "night",
  domiState = "listo",
  domiAppearance = "original",
  isReal = false
}: DomiOrbProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isLight = activeTheme === "dawn" || activeTheme === "day";

  // Resolve domiAppearance to the corresponding SVG costume
  const costume = (() => {
    if (domiAppearance === "original") return "original";
    if (domiAppearance === "estudio") return "wizard";
    if (domiAppearance === "calma") return "astronaut";
    if (domiAppearance === "protector") return "detective";
    if (domiAppearance === "cercano") return "chef";
    if (domiAppearance === "noche") return "astronaut";
    if (domiAppearance === "senior") return "detective";
    return domiAppearance || "original";
  })();

  // Retrive domiState tokens
  const token = domiStateTokens[domiState] || domiStateTokens.listo;

  const [isBlinking, setIsBlinking] = useState(false);
  const [idleMouthType, setIdleMouthType] = useState<"none" | "whistle" | "chewing" | "smile-twitch">("none");
  const [isInactive, setIsInactive] = useState(false);
  const [idleBehavior, setIdleBehavior] = useState<"reading" | "drinking" | "sleeping" | "juggling" | "none">("none");
  const [justWokeUp, setJustWokeUp] = useState(false);

  // 1. Blinking loop (slower, more natural and less hyperactive/rapid)
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      blinkTimeout = setTimeout(() => {
        setIsBlinking(false);
        // Slower frequency: blink every 5 to 11.5 seconds so it feels natural
        const nextDelay = 5000 + Math.random() * 6500;
        scheduleBlink(nextDelay);
      }, 220); // 220ms eye closure duration for a softer, visible blink
    };

    const scheduleBlink = (delay: number) => {
      blinkTimeout = setTimeout(triggerBlink, delay);
    };

    scheduleBlink(4000);
    return () => clearTimeout(blinkTimeout);
  }, []);

  // 2. Idle Mouth fidget loops
  useEffect(() => {
    let twitchInterval: NodeJS.Timeout;
    let finishTimeout: NodeJS.Timeout;
    
    const triggerTwitch = () => {
      if (domiState !== "listo" && domiState !== "descanso" && domiState !== "cercano") return;
      const types: ("none" | "whistle" | "chewing" | "smile-twitch")[] = ["whistle", "chewing", "smile-twitch"];
      const chosen = types[Math.floor(Math.random() * types.length)];
      setIdleMouthType(chosen);
      
      finishTimeout = setTimeout(() => {
        setIdleMouthType("none");
      }, 1500 + Math.random() * 1500);
    };
    
    const scheduleNext = () => {
      twitchInterval = setTimeout(() => {
        triggerTwitch();
        scheduleNext();
      }, 9000 + Math.random() * 6000);
    };
    
    scheduleNext();
    return () => {
      clearTimeout(twitchInterval);
      clearTimeout(finishTimeout);
    };
  }, [domiState]);

  // 3. Inactivity/Idle behaviors tracking
  useEffect(() => {
    let inactivityTimeout: NodeJS.Timeout;
    let wakeUpTimeout: NodeJS.Timeout;

    const resetTimer = () => {
      setIsInactive((prevInactive) => {
        if (prevInactive) {
          setJustWokeUp(true);
          clearTimeout(wakeUpTimeout);
          wakeUpTimeout = setTimeout(() => {
            setJustWokeUp(false);
          }, 1200);
        }
        return false;
      });

      setIdleBehavior("none");
      clearTimeout(inactivityTimeout);

      // 8 seconds of absolute inactivity trigger an idle state
      inactivityTimeout = setTimeout(() => {
        setIsInactive(true);
        const behaviors: ("reading" | "drinking" | "sleeping" | "juggling")[] = ["reading", "drinking", "sleeping", "juggling"];
        const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        setIdleBehavior(randomBehavior);
      }, 8000);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);

    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      clearTimeout(inactivityTimeout);
      clearTimeout(wakeUpTimeout);
    };
  }, []);

  // Parallax tracking relative to screen center
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      const ny = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      setMousePos({ x: nx, y: ny });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Voice amplitude tracking for listening/thinking reactive bokeh/particles
  const [voiceAmp, setVoiceAmp] = useState(0);

  useEffect(() => {
    if (domiState !== "escuchando" && domiState !== "pensando") {
      setVoiceAmp(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let stream: MediaStream | null = null;
    let animationId: number;

    const initAudio = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          if (!analyser || !dataArray) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalized = Math.min(average / 110, 1);
          setVoiceAmp(normalized);
          animationId = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (err) {
        // Fallback: simulated Perlin-like elegant acoustic wave
        const simulateNoise = (time: number) => {
          const simulated = 0.12 + Math.sin(time / 140) * 0.08 + Math.cos(time / 260) * 0.08 + Math.random() * 0.06;
          setVoiceAmp(Math.max(0, Math.min(simulated, 1)));
          animationId = requestAnimationFrame(simulateNoise);
        };
        animationId = requestAnimationFrame(simulateNoise);
      }
    };

    initAudio();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (source) source.disconnect();
      if (audioContext) audioContext.close();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [domiState]);


  // Define orbit nodes with absolute position styles around the central mascot
  const nodes = [
    {
      id: "salud",
      title: "Salud",
      subtitle: (medicineConfirmed || isReal) ? "Todo bien" : "Pendiente",
      icon: Heart,
      positionStyle: { left: "21%", top: "28%" },
      badge: (!medicineConfirmed && !isReal) ? "1" : null
    },
    {
      id: "compras",
      title: "Compras",
      subtitle: `${shoppingCount} por organizar`,
      icon: ShoppingCart,
      positionStyle: { left: "11%", top: "50%" },
      badge: shoppingCount > 0 ? String(shoppingCount) : null
    },
    {
      id: "estudio",
      title: "Estudio",
      subtitle: isReal ? (studyPrepared ? "Organizado" : "Al día") : (studyPrepared ? "Organizado" : "Pendiente hoy"),
      icon: BookOpen,
      positionStyle: { left: "21%", top: "72%" },
      badge: (!studyPrepared && !isReal) ? "Examen" : null
    },
    {
      id: "mensajes",
      title: "Mensajes",
      subtitle: isReal ? "Al día" : "3 sin leer",
      icon: Mail,
      positionStyle: { left: "79%", top: "28%" },
      badge: isReal ? null : "3"
    },
    {
      id: "servicios",
      title: "Servicios",
      subtitle: "Activos",
      icon: Settings,
      positionStyle: { left: "89%", top: "50%" },
      badge: null
    },
    {
      id: "bienestar",
      title: "Bienestar",
      subtitle: breathingActive ? "Respira..." : "Respirar 1 min",
      icon: Waves,
      positionStyle: { left: "79%", top: "72%" },
      badge: breathingActive ? "✓" : null
    }
  ];

  // Dynamic status-dependent pulse glows for the mascot container, using precise state colors from token
  const getDomiGlowStyle = () => {
    const shadowColor = token.primary;
    const glowColor = token.glow;
    
    if (breathingActive || domiState === "calma") {
      if (breathingCycle === "inhale") {
        return {
          boxShadow: `0 0 95px 35px ${shadowColor}88, inset 0 0 25px ${glowColor}66`,
          borderColor: `${shadowColor}60`
        };
      }
      if (breathingCycle === "hold") {
        return {
          boxShadow: `0 0 120px 48px ${glowColor}aa, inset 0 0 35px ${glowColor}88`,
          borderColor: `${glowColor}70`
        };
      }
      return {
        boxShadow: `0 0 70px 22px ${shadowColor}66, inset 0 0 15px ${glowColor}44`,
        borderColor: `${shadowColor}45`
      };
    }

    if (domiState === "escuchando") {
      const listenGlowRadius = Math.round(110 + voiceAmp * 50);
      const innerGlowRadius = Math.round(30 + voiceAmp * 30);
      return {
        boxShadow: `0 0 ${listenGlowRadius}px 45px ${shadowColor}95, 0 0 ${innerGlowRadius}px 10px ${glowColor}66`,
        borderColor: `${shadowColor}70`
      };
    }

    if (domiState === "pensando") {
      const thinkingGlowRadius = Math.round(75 + voiceAmp * 35);
      return {
        boxShadow: `0 0 ${thinkingGlowRadius}px 25px ${shadowColor}55`,
        borderColor: `${shadowColor}35`
      };
    }

    if (domiState === "protector") {
      return {
        boxShadow: `0 0 115px 48px ${shadowColor}90, inset 0 0 40px ${glowColor}40`,
        borderColor: `${shadowColor}60`
      };
    }

    if (domiState === "descanso") {
      return {
        boxShadow: `0 0 50px 15px ${shadowColor}35`,
        borderColor: `${shadowColor}20`
      };
    }

    // Default or standard state glow
    return {
      boxShadow: `0 0 90px 32px ${shadowColor}70, inset 0 0 20px ${glowColor}25`,
      borderColor: `${shadowColor}45`
    };
  };

  // Facial morphing SVG path helpers
  const getEyePath = () => {
    if (isBlinking) {
      // Closed eye resting curve
      return "M -6,-2 C -3,3 3,3 6,-2 C 3,3 -3,3 -6,-2";
    }

    const faceType = idleBehavior === "sleeping" ? "sleepy" : token.face;

    switch (faceType) {
      case "joyful":
        return "M -6,2 C -3,-4 3,-4 6,2 C 3,-4 -3,-4 -6,2";
      case "sleepy":
      case "peaceful":
        return "M -6,-2 C -3,3 3,3 6,-2 C 3,3 -3,3 -6,-2";
      case "thinking":
      case "serious":
        return "M -5.5,0 C -5.5,-2.8 5.5,-2.8 5.5,0 C 5.5,2.8 -5.5,2.8 -5.5,0 Z";
      default: // happy, speaking, attentive
        return "M -5.5,0 C -5.5,-6.5 5.5,-6.5 5.5,0 C 5.5,6.5 -5.5,6.5 -5.5,0 Z";
    }
  };

  const getEyeFill = () => {
    if (isBlinking) return "none";
    const faceType = idleBehavior === "sleeping" ? "sleepy" : token.face;
    if (faceType === "joyful" || faceType === "sleepy" || faceType === "peaceful") {
      return "none";
    }
    return "url(#eyeGrad)";
  };

  const getEyeStroke = () => {
    if (isBlinking) return "#4A2505";
    const faceType = idleBehavior === "sleeping" ? "sleepy" : token.face;
    if (faceType === "joyful" || faceType === "sleepy" || faceType === "peaceful") {
      return "#4A2505";
    }
    return "none";
  };

  const showHighlights = !isBlinking && (idleBehavior === "sleeping" ? "sleepy" : token.face) !== "joyful" && (idleBehavior === "sleeping" ? "sleepy" : token.face) !== "sleepy" && (idleBehavior === "sleeping" ? "sleepy" : token.face) !== "peaceful";

  const getMouthPath = () => {
    if (breathingActive || domiState === "calma") {
      const r = breathingCycle === "inhale" ? 5.2 : breathingCycle === "exhale" ? 3.2 : 4.2;
      return `M ${100 - r},108 C ${100 - r},${108 - r * 0.55} ${100 - r * 0.55},${108 - r} 100,${108 - r} C ${100 + r * 0.55},${108 - r} ${100 + r},${108 - r * 0.55} ${100 + r},108 C ${100 + r},${108 + r * 0.55} ${100 + r * 0.55},${108 + r} 100,${108 + r} C ${100 - r * 0.55},${108 + r} ${100 - r},${108 + r * 0.55} ${100 - r},108`;
    }

    if (token.face !== "speaking" && domiState !== "pensando" && idleBehavior !== "sleeping") {
      if (idleMouthType === "whistle") {
        // Whistling mouth circle
        return "M 96,108 C 96,104.5 104,104.5 104,108 C 104,111.5 96,111.5 96,108 Z";
      }
      if (idleMouthType === "chewing") {
        // Minimal chewing line
        return "M 95,108 C 95,108 97.5,109 100,109 C 102.5,109 105,108 105,108 C 105,108 100,106.5 95,108";
      }
      if (idleMouthType === "smile-twitch") {
        // Adorable smug smile
        return "M 93,105 C 93,105 96,112 100,111 C 104,110 107,103 107,103 C 107,103 100,105 93,105";
      }
    }

    const faceType = idleBehavior === "sleeping" ? "sleepy" : token.face;

    switch (faceType) {
      case "thinking":
        return "M 94,107 C 94,107 97,107 100,107 C 103,107 106,107 106,107 C 106,107 100,107 94,107";
      case "serious":
        return "M 94,107 C 94,107 97,108.5 100,108.5 C 103,108.5 106,107 106,107 C 106,107 100,107.2 94,107";
      case "sleepy":
      case "peaceful":
        return "M 94.5,106 C 94.5,106 97,110.5 100,110.5 C 103,110.5 105.5,106 105.5,106 C 105.5,106 100,107.5 94.5,106";
      default: // happy, speaking, joyful, attentive
        return "M 92,103 C 92,103 94,113 100,113 C 106,113 108,103 108,103 C 108,103 100,105 92,103";
    }
  };

  const getTonguePath = () => {
    return "M 94.5,106.5 C 94.5,106.5 100,112.5 105.5,106.5 C 105.5,106.5 100,108 94.5,106.5";
  };

  const faceType = idleBehavior === "sleeping" ? "sleepy" : token.face;

  const showTongue = faceType !== "thinking" && faceType !== "serious" && faceType !== "sleepy" && faceType !== "peaceful" && !breathingActive && domiState !== "calma" && idleMouthType === "none";

  const isMouthOpen = () => {
    if (breathingActive || domiState === "calma") return true;
    
    if (token.face !== "speaking" && domiState !== "pensando" && idleBehavior !== "sleeping") {
      if (idleMouthType === "whistle") return true;
      if (idleMouthType === "chewing" || idleMouthType === "smile-twitch") return false;
    }

    if (faceType === "thinking" || faceType === "serious" || faceType === "sleepy" || faceType === "peaceful") {
      return false;
    }
    return true;
  };

  return (
    <div className="relative w-full max-w-[560px] aspect-square flex items-center justify-center select-none overflow-visible mx-auto scale-[0.90] sm:scale-[1.02] md:scale-[1.08] lg:scale-[1.15] xl:scale-[1.22] origin-center transition-all duration-500">
      
      {/* 1. BACKGROUND SVG LAYER: PEDESTAL & BACK OF ORBITS */}
      <svg viewBox="0 0 500 500" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-0">
        <defs>
          {/* Exact mathematical definitions for orbital paths so elements can follow them */}
          <path id="orbitPath1" d="M 40,250 a 210,95 0 1,0 420,0 a 210,95 0 1,0 -420,0" fill="none" />
          <path id="orbitPath2" d="M 15,250 a 235,105 0 1,0 470,0 a 235,105 0 1,0 -470,0" fill="none" />
          <path id="orbitPath1Tight" d="M 120,250 a 130,55 0 1,0 260,0 a 130,55 0 1,0 -260,0" fill="none" />
          <path id="orbitPath2Tight" d="M 110,250 a 140,62 0 1,0 280,0 a 140,62 0 1,0 -280,0" fill="none" />

          {/* Premium Soft State-Dependent Gradient for Orbits */}
          <linearGradient id="goldOrbitWarm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={token.glow} stopOpacity="0.9" />
            <stop offset="35%" stopColor={token.glow} stopOpacity="0.8" />
            <stop offset="70%" stopColor={token.primary} stopOpacity="0.7" />
            <stop offset="100%" stopColor={token.accent} stopOpacity="0.9" />
          </linearGradient>

          {/* Soft translucent gold glass plate side */}
          <linearGradient id="goldMetal" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF7D8" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#FFE8A8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F8B84E" stopOpacity="0.1" />
          </linearGradient>

          {/* Metallic Gold Pedestal side skirt gradient (with high-end lighting reflections) */}
          <linearGradient id="goldMetalTier" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF2BF" />
            <stop offset="30%" stopColor="#F9C65F" />
            <stop offset="60%" stopColor="#CE851E" />
            <stop offset="100%" stopColor="#5C3401" />
          </linearGradient>

          {/* Metallic Gold Pedestal flat surface gradient */}
          <linearGradient id="goldMetalTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFAE6" />
            <stop offset="45%" stopColor="#FFD56B" />
            <stop offset="100%" stopColor="#E2921C" />
          </linearGradient>

          {/* Translucent Glass Pedestal Top Surface - Light Theme */}
          <linearGradient id="glassPedestalTopLight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.80" />
            <stop offset="40%" stopColor="#FFF9E6" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#FFECA8" stopOpacity="0.40" />
          </linearGradient>

          {/* Translucent Glass Pedestal Top Surface - Dark Theme */}
          <linearGradient id="glassPedestalTopDark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
            <stop offset="40%" stopColor="#F59E0B" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#2D2D30" stopOpacity="0.10" />
          </linearGradient>

          {/* Translucent Glass Pedestal Side/Skirt - Light Theme */}
          <linearGradient id="glassPedestalSideLight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
            <stop offset="30%" stopColor="#FFEAA8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.20" />
          </linearGradient>

          {/* Translucent Glass Pedestal Side/Skirt - Dark Theme */}
          <linearGradient id="glassPedestalSideDark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
            <stop offset="30%" stopColor="#F59E0B" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
          </linearGradient>

          {/* Translucent Glass Pedestal Rim/Stroke - Light Theme */}
          <linearGradient id="glassPedestalRimLight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.90" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.30" />
          </linearGradient>

          {/* Translucent Glass Pedestal Rim/Stroke - Dark Theme */}
          <linearGradient id="glassPedestalRimDark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.50" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.25" />
          </linearGradient>

          {/* Glowing Glass Pedestal Surface Gradient */}
          <radialGradient id="goldSurface" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF7D8" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#FFE8A8" stopOpacity="0.4" />
            <stop offset="85%" stopColor="#F8B84E" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#B96F16" stopOpacity="0.05" />
          </radialGradient>

          {/* High Intensity Glow Filter */}
          <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>        {/* --- DEEP COSMIC BACKGROUND STARDUST (Bokeh and Glow Particles) --- */}
        {/* Soft background state-colored bokeh dust with continuous floating drift */}
        <motion.g 
          opacity="0.38" 
          filter="url(#goldGlow)"
          animate={{
            scale: [1, 1.04, 0.96, 1],
            x: [0, 6, -6, 0],
            y: [0, -5, 5, 0],
          }}
          style={{ transformOrigin: "250px 250px" }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <circle cx="70" cy="150" r="4" fill={token.primary} />
          <circle cx="430" cy="120" r="3" fill={token.glow} />
          <circle cx="120" cy="340" r="5.5" fill={token.primary} />
          <circle cx="380" cy="260" r="4.5" fill={token.accent} />
          <circle cx="220" cy="110" r="3.5" fill={token.glow} />
          <circle cx="320" cy="320" r="4" fill={token.primary} />
          <circle cx="160" cy="60" r="5" fill={token.glow} />
          <circle cx="270" cy="430" r="3.2" fill={token.accent} />
        </motion.g>
 
        {/* Live sharp stardust particles - pulsing and floating dynamically */}
        <motion.g 
          filter="url(#goldGlow)"
          animate={{
            scale: [1, 0.98, 1.02, 1],
            x: [0, -3, 3, 0],
            y: [0, 4, -4, 0],
          }}
          style={{ transformOrigin: "250px 250px" }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <circle cx="90" cy="120" r="1.6" fill="#ffffff" className="animate-pulse" style={{ animationDuration: "3s" }} />
          <circle cx="410" cy="180" r="2.2" fill={token.glow} className="animate-pulse" style={{ animationDuration: "2.5s" }} />
          <circle cx="130" cy="290" r="1.2" fill="#ffffff" />
          <circle cx="370" cy="310" r="1.8" fill={token.glow} className="animate-pulse" style={{ animationDuration: "4s" }} />
          <circle cx="210" cy="80" r="2.4" fill="#ffffff" className="animate-pulse" style={{ animationDuration: "3.5s" }} />
          <circle cx="310" cy="110" r="1.5" fill={token.primary} />
          <circle cx="60" cy="220" r="2.5" fill="#ffffff" className="animate-pulse" style={{ animationDuration: "2s" }} />
          <circle cx="440" cy="270" r="1.6" fill={token.glow} />
          <circle cx="150" cy="130" r="1.8" fill="#ffffff" className="animate-pulse" style={{ animationDuration: "4.5s" }} />
          <circle cx="340" cy="380" r="2.2" fill={token.primary} className="animate-pulse" style={{ animationDuration: "3s" }} />
          <circle cx="280" cy="60" r="1.2" fill="#ffffff" />
          <circle cx="180" cy="420" r="2" fill="#fff8e1" className="animate-pulse" style={{ animationDuration: "5s" }} />
          <circle cx="390" cy="90" r="1.5" fill="#ffffff" />
        </motion.g>

        {/* --- ORBIT BACKGROUND LINES (Double-pass for neon glowing warm glass effect) --- */}
        {/* --- FAINT OUTER ORBITS (Sostienen y cruzan los iconos) --- */}
        {/* Orbit 1 Wide */}
        <g transform="rotate(-15 250 250)">
          <ellipse cx="250" cy="250" rx="210" ry="95" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.6" className="opacity-20" />
        </g>
        {/* Orbit 3 Wide */}
        <ellipse cx="250" cy="250" rx="245" ry="140" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.5" className="opacity-15" />

        {/* --- SHINY TIGHT ORBITS (Ceñidas a la esfera con puntos de luz vivos) --- */}
        {/* Tight Orbit 1 */}
        <g transform="rotate(-15 250 250)">
          <ellipse cx="250" cy="250" rx="130" ry="55" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="2.0" filter="url(#goldGlow)" className="opacity-45" />
          <ellipse cx="250" cy="250" rx="130" ry="55" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.9" className="opacity-85" />

          {/* Flowing cosmic stardust particles (Orbit 1 Tight) */}
          <circle r="2.8" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="0s">
              <mpath href="#orbitPath1Tight" />
            </animateMotion>
          </circle>
          <circle r="2.0" fill="#ffd54f" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="1.8s">
              <mpath href="#orbitPath1Tight" />
            </animateMotion>
          </circle>
          <circle r="2.4" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="3.6s">
              <mpath href="#orbitPath1Tight" />
            </animateMotion>
          </circle>
          {/* Sparkle star on tight orbit */}
          <path d="M 0 -5 Q 0 0 5 0 Q 0 0 0 5 Q 0 0 -5 0 Q 0 0 0 -5 Z" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="2.7s">
              <mpath href="#orbitPath1Tight" />
            </animateMotion>
          </path>

          {/* Adorable Glowing Golden Heart Loop on the right side of Orbit 1 Tight (matching the image) */}
          <g transform="translate(380, 250) rotate(-35) scale(1.35)">
            {/* Glow backing */}
            <path 
              d="M 0,-4 C -3,-9 -9,-9 -9,-3 C -9,2 -2,7 0,9 C 2,7 9,2 9,-3 C 9,-9 3,-9 0,-4 Z" 
              fill="none" 
              stroke="url(#goldOrbitWarm)" 
              strokeWidth="2.8" 
              filter="url(#goldGlow)" 
              opacity="0.95" 
            />
            {/* Sharp core */}
            <path 
              d="M 0,-4 C -3,-9 -9,-9 -9,-3 C -9,2 -2,7 0,9 C 2,7 9,2 9,-3 C 9,-9 3,-9 0,-4 Z" 
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="1.1" 
              opacity="0.95" 
            />
          </g>

          {/* Star Sparkle on Left edge of Tight Orbit 1 */}
          <g transform="translate(122, 250) scale(0.65)">
            <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" filter="url(#goldGlow)" />
            <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" />
          </g>
          {/* Star Sparkle near the Heart Loop */}
          <g transform="translate(365, 260) scale(0.55)">
            <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" filter="url(#goldGlow)" />
            <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" />
          </g>
        </g>

        {/* Tight Orbit 2 */}
        <g transform="rotate(22 250 250)">
          <ellipse cx="250" cy="250" rx="140" ry="62" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="1.8" filter="url(#goldGlow)" className="opacity-35" />
          <ellipse cx="250" cy="250" rx="140" ry="62" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.8" className="opacity-75" />

          {/* Flowing cosmic stardust particles (Orbit 2 Tight) */}
          <circle r="2.4" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="7.5s" repeatCount="indefinite" begin="0s">
              <mpath href="#orbitPath2Tight" />
            </animateMotion>
          </circle>
          <circle r="1.8" fill="#ffe082" filter="url(#goldGlow)">
            <animateMotion dur="7.5s" repeatCount="indefinite" begin="3.75s">
              <mpath href="#orbitPath2Tight" />
            </animateMotion>
          </circle>

          {/* Star Sparkle on Right edge of Tight Orbit 2 */}
          <g transform="translate(390, 250) scale(0.55)">
            <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" filter="url(#goldGlow)" />
            <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" />
          </g>
        </g>

        {/* --- STARS & FLARES IN ATMOSPHERE (Brilliant 4-Point High-Gleam Stars) --- */}
        <g filter="url(#goldGlow)">
          <path d="M 85 180 Q 85 188 93 188 Q 85 188 85 196 Q 85 188 77 188 Q 85 188 85 180 Z" fill="#ffffff" className="opacity-95" />
          <path d="M 175 330 Q 175 338 183 338 Q 175 338 175 346 Q 175 338 167 338 Q 175 338 175 330 Z" fill="#ffffff" className="opacity-90" />
          <path d="M 380 140 Q 380 148 388 148 Q 380 148 380 156 Q 380 148 372 148 Q 380 148 380 140 Z" fill="#ffffff" className="opacity-95" />
          <path d="M 320 290 Q 320 298 328 298 Q 320 298 320 306 Q 320 298 312 298 Q 320 298 320 290 Z" fill="#ffd54f" className="opacity-85" />
        </g>

        {/* --- HIGH-FIDELITY CONCENTRIC THREE-TIERED TRANSLUCENT GLASS PEDESTAL (REPLICATING THE REFERENCE PHOTO) --- */}
        {/* Tier 1 (Bottom, Widest) */}
        {/* Deep shadow on the cosmic floor */}
        <g filter="url(#orbitShadowFilter)" opacity={isLight ? "0.15" : "0.5"}>
          <ellipse cx="250" cy="415" rx="140" ry="24" fill="#000000" />
        </g>
        {/* Side/skirt 3D extrude for Bottom Tier */}
        <path 
          d="M 110 405 A 140 26 0 0 0 390 405 L 390 415 A 140 26 0 0 1 110 415 Z" 
          fill={isLight ? "url(#glassPedestalSideLight)" : "url(#glassPedestalSideDark)"} 
        />
        {/* Flat Top Surface of Bottom Tier - Translucent amber gold glass */}
        <ellipse 
          cx="250" 
          cy="405" 
          rx="140" 
          ry="26" 
          fill={isLight ? "url(#glassPedestalTopLight)" : "url(#glassPedestalTopDark)"} 
          stroke={isLight ? "url(#glassPedestalRimLight)" : "url(#glassPedestalRimDark)"} 
          strokeWidth="1.2" 
        />
        {/* Glowing aura under-rim for Bottom Tier */}
        <path 
          d="M 110 405 A 140 26 0 0 0 390 405" 
          fill="none" 
          stroke="#FFEAA8" 
          strokeWidth="3.0" 
          filter="url(#goldGlow)" 
          opacity={isLight ? "0.55" : "0.85"} 
        />
        {/* Crisp White-Gold Front Lip Highlight (matches the image's shining rims exactly) */}
        <path 
          d="M 111 405 A 139 25 0 0 0 389 405" 
          fill="none" 
          stroke="#FFFFFF" 
          strokeWidth="1.3" 
          strokeLinecap="round" 
          opacity="0.95" 
        />

        {/* Tier 2 (Middle) */}
        {/* Side/skirt 3D extrude for Middle Tier */}
        <path 
          d="M 140 382 A 110 20 0 0 0 360 382 L 360 392 A 110 20 0 0 1 140 392 Z" 
          fill={isLight ? "url(#glassPedestalSideLight)" : "url(#glassPedestalSideDark)"} 
        />
        {/* Flat Top Surface of Middle Tier */}
        <ellipse 
          cx="250" 
          cy="382" 
          rx="110" 
          ry="20" 
          fill={isLight ? "url(#glassPedestalTopLight)" : "url(#glassPedestalTopDark)"} 
          stroke={isLight ? "url(#glassPedestalRimLight)" : "url(#glassPedestalRimDark)"} 
          strokeWidth="1.2" 
        />
        {/* Glowing aura under-rim for Middle Tier */}
        <path 
          d="M 140 382 A 110 20 0 0 0 360 382" 
          fill="none" 
          stroke="#FFEAA8" 
          strokeWidth="3.0" 
          filter="url(#goldGlow)" 
          opacity={isLight ? "0.6" : "0.9"} 
        />
        {/* Crisp White-Gold Front Lip Highlight */}
        <path 
          d="M 141 382 A 109 19 0 0 0 359 382" 
          fill="none" 
          stroke="#FFFFFF" 
          strokeWidth="1.3" 
          strokeLinecap="round" 
          opacity="0.95" 
        />

        {/* Tier 3 (Top, Smallest) */}
        {/* Side/skirt 3D extrude for Top Tier */}
        <path 
          d="M 170 360 A 80 15 0 0 0 330 360 L 330 368 A 80 15 0 0 1 170 368 Z" 
          fill={isLight ? "url(#glassPedestalSideLight)" : "url(#glassPedestalSideDark)"} 
        />
        {/* Flat Top Surface of Top Tier */}
        <ellipse 
          cx="250" 
          cy="360" 
          rx="80" 
          ry="15" 
          fill={isLight ? "url(#glassPedestalTopLight)" : "url(#glassPedestalTopDark)"} 
          stroke={isLight ? "url(#glassPedestalRimLight)" : "url(#glassPedestalRimDark)"} 
          strokeWidth="1.2" 
        />
        {/* Glowing aura under-rim for Top Tier */}
        <path 
          d="M 170 360 A 80 15 0 0 0 330 360" 
          fill="none" 
          stroke="#FFEAA8" 
          strokeWidth="3.0" 
          filter="url(#goldGlow)" 
          opacity={isLight ? "0.65" : "0.95"} 
        />
        {/* Crisp White-Gold Front Lip Highlight */}
        <path 
          d="M 171 360 A 79 14 0 0 0 329 360" 
          fill="none" 
          stroke="#FFFFFF" 
          strokeWidth="1.3" 
          strokeLinecap="round" 
          opacity="0.95" 
        />

        {/* Levitation Glow Light Cone Beam (Emerging from top tier to levitate Domi) */}
        <g opacity={isLight ? "0.35" : "0.55"} filter="url(#goldGlow)">
          <path d="M 210 360 L 140 230 L 360 230 L 290 360 Z" fill="url(#goldSurface)" />
        </g>

        {/* Core Luminous Well inside the top tier */}
        <ellipse cx="250" cy="360" rx="42" ry="8" fill="#FFFDF2" filter="url(#goldGlow)" opacity="0.65" />
        <ellipse cx="250" cy="360" rx="18" ry="3.5" fill="#FFFFFF" filter="url(#goldGlow)" opacity="0.9" />

        {/* Beautiful magical star glints on the corners of the pedestal (exactly matching the image) */}
        {/* Left side sparkle */}
        <g transform="translate(135, 410) scale(0.65)">
          <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" filter="url(#goldGlow)" />
          <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" />
        </g>
        {/* Right side soft sparkle */}
        <g transform="translate(365, 410) scale(0.45)">
          <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#ffffff" filter="url(#goldGlow)" opacity="0.8" />
        </g>
      </svg>

      {/* 2. ATMOSPHERIC AMBIENT GLOW BACKDROP */}
      <div className="absolute w-[280px] h-[280px] rounded-full bg-radial from-amber-500/25 via-orange-500/5 to-transparent blur-3xl pointer-events-none z-0" />

      {/* 3. INTERACTIVE GLASSY ORBIT NODES */}
      {nodes.map((node) => {
        const Icon = node.icon;
        return (
          <button
            key={node.id}
            onClick={() => onNodeClick(node.id)}
            className="absolute flex flex-col items-center group/node cursor-pointer z-20 transition-all duration-300"
            style={{
              ...node.positionStyle,
              transform: "translate(-50%, -50%)"
            }}
          >
            {/* Circular Glass Capsule Node */}
            <div className={`relative w-[46px] h-[46px] rounded-full border flex items-center justify-center transition-all duration-300 backdrop-blur-md shrink-0 ${
              isLight 
                ? "bg-white/80 border-amber-500/20 shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_4px_12px_rgba(185,111,22,0.1),0_0_15px_rgba(245,158,11,0.1)] group-hover/node:border-amber-400 group-hover/node:shadow-[inset_0_3px_6px_rgba(255,255,255,1),0_6px_16px_rgba(185,111,22,0.15),0_0_22px_rgba(245,158,11,0.3)] group-hover/node:scale-110" 
                : "bg-gradient-to-tr from-white/10 via-amber-500/5 to-amber-300/10 border-amber-500/35 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_12px_rgba(0,0,0,0.5),0_0_15px_rgba(245,158,11,0.2)] group-hover/node:border-amber-300/85 group-hover/node:shadow-[inset_0_3px_6px_rgba(255,255,255,0.5),0_6px_16px_rgba(0,0,0,0.6),0_0_22px_rgba(245,158,11,0.55)] group-hover/node:scale-110"
            }`}>
              {/* Top glossy crescent reflection */}
              <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-[85%] h-[35%] rounded-t-full bg-gradient-to-b from-white/35 to-transparent pointer-events-none opacity-85" />
              
              {/* Softer bottom reflection */}
              <div className="absolute bottom-1 w-[60%] h-[15%] rounded-full bg-amber-400/15 filter blur-[1px] pointer-events-none" />

              {/* Rotating border sweep shine */}
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                animate={{ rotate: 360 }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
              >
                {/* Luminous spark positioned right on the outer border perimeter */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.2 h-1.2 rounded-full bg-white shadow-[0_0_6px_#f59e0b,0_0_12px_#ffffff]" />
              </motion.div>

              {/* Red-Amber Alert Badge */}
              {node.badge && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 leading-none shadow-[0_0_8px_rgba(245,158,11,0.6)] z-30">
                  {node.badge}
                </span>
              )}
              
              <Icon className={`w-5 h-5 transition-transform duration-300 relative z-10 ${
                isLight ? "text-amber-600 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" : "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.85)]"
              }`} />
            </div>

            {/* Labels beneath the capsule */}
            <div className="text-center mt-1.5 min-w-[100px]">
              <span className={`block text-[13px] font-semibold group-hover/node:text-amber-500 transition-colors tracking-wide leading-tight ${
                isLight ? "text-slate-800" : "text-slate-100"
              }`}>
                {node.title}
              </span>
              <span className={`block text-[11px] group-hover/node:text-slate-700 font-sans mt-0.5 font-medium leading-none ${
                isLight ? "text-slate-500" : "text-amber-200/60"
              }`}>
                {node.subtitle}
              </span>
            </div>
          </button>
        );
      })}

      {/* 4. THE PROTAGONIST: DOMI MASCOT (3D MASTERCLASS WORK) */}
      <motion.div 
        id="domi-mascot"
        onClick={() => onNodeClick("domi")}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative z-10 flex flex-col items-center cursor-pointer group"
        animate={{
          y: [0, -7, 0],
          scale: [0.99, 1.015, 0.99]
        }}
        transition={{
          duration: 7.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Levitating Outer Glass Bubble Container with reactive status shadows */}
        <div 
          style={getDomiGlowStyle()}
          className="relative w-[215px] h-[215px] sm:w-[230px] sm:h-[230px] md:w-[245px] md:h-[245px] rounded-full flex items-center justify-center border transition-all duration-700 overflow-visible"
        >
          
          {/* SVG representation for ultimate 3D fidelity (Gradients, Specular, Shadows, Blinks, Smiley) */}
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full overflow-visible select-none pointer-events-none">
            <defs>
              {/* Radial gradient of the inner core sphere creating a soft golden glass appearance */}
              <radialGradient id="innerSphereGrad" cx="35%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#FFFDF4" />
                <stop offset="22%" stopColor="#FFF2C3" />
                <stop offset="55%" stopColor="#FBBF54" />
                <stop offset="85%" stopColor="#E28723" />
                <stop offset="100%" stopColor="#9C4C01" />
              </radialGradient>

              {/* Fresnel shader wrapping the sphere edges in soft golden glass depth */}
              <radialGradient id="fresnelShade" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="#A05206" stopOpacity="0" />
                <stop offset="90%" stopColor="#A05206" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#A05206" stopOpacity="0.55" />
              </radialGradient>

              {/* Subsurface scattering radial glow that makes Domi feel organic and alive */}
              <radialGradient id="subsurfaceGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={token.glow} stopOpacity="0.9" />
                <stop offset="45%" stopColor={token.primary} stopOpacity="0.55" />
                <stop offset="100%" stopColor={token.accent} stopOpacity="0" />
              </radialGradient>

              {/* Double-pass glass bubble refraction for the outer crystal sphere */}
              <radialGradient id="glassCore" cx="30%" cy="25%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="35%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="75%" stopColor="#FFE8A8" stopOpacity="0.01" />
                <stop offset="93%" stopColor="#ffffff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.65" />
              </radialGradient>

              {/* 3D secondary bounce reflection from the pedestal environment */}
              <radialGradient id="bounceLight" cx="70%" cy="85%" r="50%">
                <stop offset="0%" stopColor="#FFFDF4" stopOpacity="0.8" />
                <stop offset="40%" stopColor="#FBBF54" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#9C4C01" stopOpacity="0" />
              </radialGradient>

              {/* Outer glass rim highlight */}
              <linearGradient id="glassRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                <stop offset="35%" stopColor="#ffffff" stopOpacity="0.2" />
                <stop offset="65%" stopColor="#FFE8A8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
              </linearGradient>

              {/* Outer glass highlight crescent */}
              <linearGradient id="glassReflection" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>

              {/* Soft rosy cheek radial gradient (Rich, high-fidelity warm pink rosy cheeks) */}
              <radialGradient id="rosyBlush" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FF8DA1" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FF8DA1" stopOpacity="0" />
              </radialGradient>

              {/* Intense soft aura/halo surrounding the mascot */}
              <radialGradient id="goldenHaloAura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={token.glow} stopOpacity="0.95" />
                <stop offset="40%" stopColor={token.glow} stopOpacity="0.7" />
                <stop offset="75%" stopColor={token.primary} stopOpacity="0.45" />
                <stop offset="100%" stopColor={token.accent} stopOpacity="0" />
              </radialGradient>

              {/* Soft friendly warm cocoa brown eye gradient */}
              <linearGradient id="eyeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#250F02" />
                <stop offset="60%" stopColor="#4A2505" />
                <stop offset="100%" stopColor="#8C4E15" />
              </linearGradient>

              {/* Soft mouth shadow */}
              <filter id="mouthShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#B96F16" floodOpacity="0.35" />
              </filter>

              {/* Projected Orbit Shadow Filter */}
              <filter id="orbitShadowFilter" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="3.2" result="blur" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.1   0 0 0 0 0.05   0 0 0 0 0   0 0 0 0.7 0" />
              </filter>

              {/* Mascot inner sphere clip path */}
              <clipPath id="innerSphereClip">
                <circle cx="100" cy="100" r="74" />
              </clipPath>

              {/* Scaled overlap clip paths for casting shadows on the 3D sphere */}
              <clipPath id="frontClipMascot">
                <rect x="88" y="0" width="112" height="200" />
              </clipPath>
              <clipPath id="leftClipMascot">
                <rect x="0" y="0" width="102" height="200" />
              </clipPath>
            </defs>

            {/* --- GLASS INNER SHADOW, BASE GLOWS & WARM HALO --- */}
            {/* Soft, warm outer halo effect around the golden glass shell */}
            <circle cx="100" cy="100" r="95" fill="url(#goldenHaloAura)" opacity={
              activeTheme === "dawn" ? 0.65 :
              activeTheme === "day" ? 0.55 :
              activeTheme === "sunset" ? 0.85 : 0.95
            } filter="url(#goldGlow)" />
            <circle cx="100" cy="100" r="95" fill="none" stroke="#FFE8A8" strokeWidth="1.8" filter="url(#goldGlow)" opacity="0.45" />

            <circle cx="100" cy="100" r="95" fill="none" stroke="url(#glassRim)" strokeWidth="1.2" opacity="0.85" />
            <circle cx="100" cy="100" r="92" fill="#ffca28" fillOpacity="0.04" />

            {/* --- 4A. INNER GOLDEN SPHERE (THE CORE MASCOT BODY) --- */}
            {/* Dynamic interactive 3D parallax motion: translates based on screen mouse coordinates */}
            <motion.g
              animate={{
                x: mousePos.x * 6.5,
                y: mousePos.y * 3.8,
              }}
              transition={{ type: "spring", stiffness: 75, damping: 18 }}
            >
              {/* STUNNING ORGANIC GOLDEN HALO / LUMINOSITY SURROUNDING THE YELLOW SPHERE */}
              <circle cx="100" cy="100" r="86" fill="url(#goldenHaloAura)" filter="url(#goldGlow)" opacity="0.9" />

              {/* Golden 3D body sphere */}
              <circle cx="100" cy="100" r="74" fill="url(#innerSphereGrad)" />
              
              {/* Fresnel outer-edge shading layer for rich 3D curvature shadows */}
              <circle cx="100" cy="100" r="74" fill="url(#fresnelShade)" />

              {/* Secondary 3D bounce lighting reflection from pedestal environment */}
              <circle cx="100" cy="100" r="74" fill="url(#bounceLight)" style={{ mixBlendMode: "screen" }} />

              {/* Subsurface warmth glow centered behind face features for organic glowing presence */}
              <circle cx="100" cy="106" r="45" fill="url(#subsurfaceGlow)" style={{ mixBlendMode: "screen" }} opacity="0.75" />

              {/* --- 4B. THE CUTE LIVING SMILEY FACE --- */}
              {/* Face coordinates shifted slightly more for enhanced 3D curved surface depth illusion */}
              <motion.g
                animate={{
                  x: mousePos.x * 12.5,
                  y: mousePos.y * 7.5,
                }}
                transition={{ type: "spring", stiffness: 70, damping: 14 }}
              >
                {/* 1. SOFT ROSY CHEEKS (Matching the soft pink ellipses of the reference image) */}
                <ellipse cx="64" cy="103" rx={domiState === "cercano" ? 12 : 7.5} ry={domiState === "cercano" ? 7.5 : 4.5} fill="url(#rosyBlush)" />
                <ellipse cx="136" cy="103" rx={domiState === "cercano" ? 12 : 7.5} ry={domiState === "cercano" ? 7.5 : 4.5} fill="url(#rosyBlush)" />
                {/* Micro cheek sparkles (delicate glints on top of the blush) */}
                <ellipse cx="61" cy="101" rx={domiState === "cercano" ? 3.0 : 2.2} ry="1.0" fill="#ffffff" fillOpacity="0.85" />
                <ellipse cx="133" cy="101" rx={domiState === "cercano" ? 3.0 : 2.2} ry="1.0" fill="#ffffff" fillOpacity="0.85" />

                {/* 2. EXPRESSIVE FRIENDLY GLASSY EYES WITH VECTOR MORPHING */}
                <g transform="translate(73, 94)">
                  <motion.path 
                    d={getEyePath()} 
                    fill={getEyeFill()} 
                    stroke={getEyeStroke()} 
                    strokeWidth="3.2" 
                    strokeLinecap="round" 
                    transition={{ type: "spring", stiffness: 80, damping: 12 }}
                  />
                  {/* Catchlights scaling and fading out smoothly when eyes are closed */}
                  <motion.circle 
                    cx="-1.8" 
                    cy="-2.0" 
                    r="1.8" 
                    fill="#ffffff" 
                    animate={{ scale: showHighlights ? 1 : 0, opacity: showHighlights ? 1 : 0 }} 
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  />
                  <motion.circle 
                    cx="2.0" 
                    cy="2.2" 
                    r="0.9" 
                    fill="#ffffff" 
                    animate={{ scale: showHighlights ? 0.85 : 0, opacity: showHighlights ? 0.85 : 0 }} 
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  />
                </g>

                <g transform="translate(127, 94)">
                  <motion.path 
                    d={getEyePath()} 
                    fill={getEyeFill()} 
                    stroke={getEyeStroke()} 
                    strokeWidth="3.2" 
                    strokeLinecap="round" 
                    transition={{ type: "spring", stiffness: 80, damping: 12 }}
                  />
                  <motion.circle 
                    cx="-1.8" 
                    cy="-2.0" 
                    r="1.8" 
                    fill="#ffffff" 
                    animate={{ scale: showHighlights ? 1 : 0, opacity: showHighlights ? 1 : 0 }} 
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  />
                  <motion.circle 
                    cx="2.0" 
                    cy="2.2" 
                    r="0.9" 
                    fill="#ffffff" 
                    animate={{ scale: showHighlights ? 0.85 : 0, opacity: showHighlights ? 0.85 : 0 }} 
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  />
                </g>

                {/* 3. COOP-OPEN ADORABLE WATERMELON SMILE WITH VECTOR MORPHING */}
                <g>
                  {/* Dynamic Voice/Speaking oscillation if speaking */}
                  <motion.g
                    animate={token.face === "speaking" ? {
                      scaleY: [0.9, 1.3, 0.8, 1.25, 0.9]
                    } : {
                      scaleY: 1
                    }}
                    transition={token.face === "speaking" ? {
                      duration: 0.38,
                      repeat: Infinity,
                      ease: "easeInOut"
                    } : {}}
                    style={{ transformOrigin: "100px 108px" }}
                  >
                    {/* Deep cocoa back cavity with SVG morphing */}
                    <motion.path 
                      d={getMouthPath()} 
                      fill={isMouthOpen() ? "#250F02" : "none"} 
                      stroke={isMouthOpen() ? "#4A2703" : "#4A2502"} 
                      strokeWidth={isMouthOpen() ? "1.2" : "1.8"} 
                      strokeLinecap="round"
                      strokeLinejoin="round" 
                      transition={{ type: "spring", stiffness: 80, damping: 12 }}
                    />
                    
                    {/* Rosy/coral tongue with visual fade and morph */}
                    <motion.path 
                      d={getTonguePath()} 
                      fill="#FFA3A3" 
                      animate={{ 
                        opacity: showTongue ? 1 : 0,
                        scale: showTongue ? 1 : 0.5 
                      }}
                      transition={{ type: "spring", stiffness: 90, damping: 14 }}
                      style={{ transformOrigin: "100px 108px" }}
                    />
                    
                    {/* Crisp upper lip line */}
                    <motion.path 
                      d={faceType === "thinking" || faceType === "serious" || faceType === "sleepy" || faceType === "peaceful" || breathingActive || domiState === "calma" || idleMouthType !== "none"
                        ? "M 100,107 Q 100,107 100,107" // Hidden or flat
                        : "M 92,103 Q 100,104 108,103"
                      }
                      stroke="#4A2703" 
                      strokeWidth="1.6" 
                      strokeLinecap="round" 
                      fill="none" 
                      transition={{ type: "spring", stiffness: 85, damping: 13 }}
                    />
                  </motion.g>
                </g>

                {/* --- 4D. CARTOON GLOVED HANDS & ACCESSORIES (IDLE BEHAVIORS) --- */}
                <AnimatePresence>
                  {idleBehavior === "reading" && (
                    <motion.g
                      key="reading-behavior"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    >
                      {/* Open book/magazine */}
                      {/* Left Page (Soft white glow) */}
                      <path d="M 100,148 L 72,142 L 72,122 L 100,129 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                      {/* Right Page */}
                      <path d="M 100,148 L 128,142 L 128,122 L 100,129 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                      {/* Book lines / text lines */}
                      <path d="M 77,128 L 95,133 M 77,133 L 95,138 M 77,138 L 91,141" stroke="#8C4E15" strokeWidth="0.8" strokeLinecap="round" />
                      <path d="M 105,133 L 123,128 M 105,138 L 123,133 M 105,141 L 119,138" stroke="#8C4E15" strokeWidth="0.8" strokeLinecap="round" />
                      {/* Left Hand holding book - beautiful cartoon glove with fingers */}
                      <g transform="translate(62, 142) rotate(-8)">
                        {/* Cuff */}
                        <path d="M -8,0 C -8,-4 -4,-6 -4,-2 C -4,2 -8,4 -8,0" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        {/* Palm */}
                        <path d="M -6,-4 Q -1,-4 0,0 Q -1,4 -6,4 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        {/* Curved fingers grasping */}
                        <path d="M 0,-3 C 3,-5 6,-3 4,1 C 2,3 0,1 0,-3 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        <path d="M -1,-1 C 2,-3 5,-1 3,3 C 1,5 -1,3 -1,-1 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        <path d="M -2,1 C 1,-1 4,1 2,5 C 0,7 -2,5 -2,1 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                      </g>
                      {/* Right Hand holding book - beautiful cartoon glove with fingers */}
                      <g transform="translate(138, 142) rotate(8)">
                        {/* Cuff */}
                        <path d="M 8,0 C 8,-4 4,-6 4,-2 C 4,2 8,4 8,0" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        {/* Palm */}
                        <path d="M 6,-4 Q 1,-4 0,0 Q 1,4 6,4 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        {/* Curved fingers grasping */}
                        <path d="M 0,-3 C -3,-5 -6,-3 -4,1 C -2,3 0,1 0,-3 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        <path d="M 1,-1 C -2,-3 -5,-1 -3,3 C -1,5 1,3 1,-1 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        <path d="M 2,1 C -1,-1 -4,1 -2,5 C 0,7 2,5 2,1 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                      </g>
                    </motion.g>
                  )}

                  {idleBehavior === "drinking" && (
                    <motion.g
                      key="drinking-behavior"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    >
                      {/* Animated right hand and mug */}
                      <motion.g
                        animate={{ 
                          rotate: [0, -22, -22, 0, 0],
                          y: [0, -5, -5, 0, 0]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 4, 
                          ease: "easeInOut" 
                        }}
                        style={{ transformOrigin: "135px 145px" }}
                      >
                        {/* Cozy Red-Amber mug */}
                        <rect x="122" y="125" width="16" height="18" rx="3" fill="#E11D48" stroke="#4A2502" strokeWidth="1.2" />
                        {/* Mug handle */}
                        <path d="M 138,129 C 142,129 142,139 138,139" fill="none" stroke="#4A2502" strokeWidth="1.2" />
                        {/* Mug steam floating upwards */}
                        <motion.path 
                          d="M 130,121 C 128,114 132,108 130,101" 
                          fill="none" 
                          stroke="#ffffff" 
                          strokeWidth="1.0" 
                          strokeLinecap="round"
                          animate={{ 
                            pathLength: [0, 1, 1],
                            opacity: [0, 0.8, 0],
                            y: [0, -6]
                          }}
                          transition={{ 
                            repeat: Infinity, 
                            duration: 2, 
                            ease: "easeInOut" 
                          }}
                        />
                        {/* Right hand holding mug - beautiful cartoon glove with fingers */}
                        <g transform="translate(116, 134) rotate(-32)">
                          {/* Cuff */}
                          <path d="M -8,0 C -8,-4 -4,-6 -4,-2 C -4,2 -8,4 -8,0" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          {/* Palm */}
                          <path d="M -6,-4 Q -1,-4 0,0 Q -1,4 -6,4 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          {/* Curved fingers wrapping */}
                          <path d="M 0,-3 C 3,-5 6,-3 4,1 C 2,3 0,1 0,-3 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          <path d="M -1,-1 C 2,-3 5,-1 3,3 C 1,5 -1,3 -1,-1 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          <path d="M -2,1 C 1,-1 4,1 2,5 C 0,7 -2,5 -2,1 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        </g>
                      </motion.g>
                    </motion.g>
                  )}

                  {idleBehavior === "sleeping" && (
                    <motion.g
                      key="sleeping-behavior"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {/* Zzz Floating bubbles */}
                      <g transform="translate(142, 65)">
                        <motion.text 
                          x="0" y="0" 
                          fill={token.glow} 
                          fontSize="13" 
                          fontWeight="bold" 
                          fontFamily="monospace"
                          style={{ textShadow: "0 0 4px rgba(245,158,11,0.5)" }}
                          animate={{ x: [0, 8, -4, 4], y: [0, -22, -45, -68], opacity: [0, 1, 1, 0], scale: [0.7, 1, 1.2, 0.8] }}
                          transition={{ repeat: Infinity, duration: 3.5, delay: 0 }}
                        >
                          Z
                        </motion.text>
                        <motion.text 
                          x="8" y="-12" 
                          fill={token.glow} 
                          fontSize="9" 
                          fontWeight="bold" 
                          fontFamily="monospace"
                          style={{ textShadow: "0 0 4px rgba(245,158,11,0.4)" }}
                          animate={{ x: [8, 18, 10, 16], y: [-12, -38, -64, -90], opacity: [0, 1, 1, 0], scale: [0.7, 1, 1.2, 0.8] }}
                          transition={{ repeat: Infinity, duration: 3.5, delay: 1.1 }}
                        >
                          z
                        </motion.text>
                        <motion.text 
                          x="-8" y="-24" 
                          fill={token.primary} 
                          fontSize="7" 
                          fontWeight="bold" 
                          fontFamily="monospace"
                          style={{ textShadow: "0 0 4px rgba(245,158,11,0.3)" }}
                          animate={{ x: [-8, -4, -12, -8], y: [-24, -50, -76, -102], opacity: [0, 1, 1, 0], scale: [0.7, 1, 1.2, 0.8] }}
                          transition={{ repeat: Infinity, duration: 3.5, delay: 2.2 }}
                        >
                          z
                        </motion.text>
                      </g>
                    </motion.g>
                  )}

                  {idleBehavior === "juggling" && (
                    <motion.g
                      key="juggling-behavior"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    >
                      {/* Juggling Sparkle Ball rising and falling */}
                      <motion.circle 
                        r="5"
                        fill="#FFE8A8" 
                        filter="url(#goldGlow)"
                        animate={{ 
                          y: [140, 75, 140, 75, 140],
                          x: [55, 100, 145, 100, 55],
                          scale: [1, 1.3, 1, 1.3, 1]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 2.2, 
                          ease: "easeInOut" 
                        }}
                      />
                      
                      {/* Left Hand juggling - gorgeous cartoon hand with fingers */}
                      <motion.g
                        animate={{ y: [0, -6, 0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                      >
                        <g transform="translate(45, 138) rotate(30)">
                          {/* Cuff */}
                          <path d="M -10,0 C -10,-4 -6,-6 -6,-2 C -6,2 -10,4 -10,0" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          {/* Palm open upwards */}
                          <path d="M -8,-2 Q -2,-5 0,0 Q -2,5 -8,3 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          {/* Fingers open upwards to catch */}
                          <path d="M -2,-3 C 1,-8 5,-6 2,-1 C 0,2 -2,0 -2,-3 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          <path d="M -4,-5 C -1,-10 3,-8 0,-3 C -2,0 -4,-2 -4,-5 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          <path d="M -6,-6 C -3,-11 1,-9 -2,-4 C -4,-1 -6,-3 -6,-6 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        </g>
                      </motion.g>
                      {/* Right Hand juggling - gorgeous cartoon hand with fingers */}
                      <motion.g
                        animate={{ y: [0, -6, 0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 1.25 }}
                      >
                        <g transform="translate(155, 138) rotate(-30)">
                          {/* Cuff */}
                          <path d="M 10,0 C 10,-4 6,-6 6,-2 C 6,2 10,4 10,0" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          {/* Palm open upwards */}
                          <path d="M 8,-2 Q 2,-5 0,0 Q 2,5 8,3 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          {/* Fingers open upwards to catch */}
                          <path d="M 2,-3 C -1,-8 -5,-6 -2,-1 C 0,2 2,0 2,-3 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          <path d="M 4,-5 C 1,-10 -3,-8 0,-3 C 2,0 4,-2 4,-5 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                          <path d="M 6,-6 C 3,-11 -1,-9 2,-4 C 4,-1 6,-3 6,-6 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.2" />
                        </g>
                      </motion.g>
                    </motion.g>
                  )}
                </AnimatePresence>

                {/* Surprise Exclamation bubble when waking up */}
                <AnimatePresence>
                  {justWokeUp && (
                    <motion.g
                      key="wakeup-alert"
                      initial={{ opacity: 0, scale: 0, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0, y: -10 }}
                      transition={{ type: "spring", stiffness: 150, damping: 10 }}
                      transform="translate(100, 22)"
                    >
                      {/* Floating bubble background */}
                      <circle cx="0" cy="0" r="10" fill="#FACC15" filter="url(#goldGlow)" />
                      <circle cx="0" cy="0" r="10" fill="#FACC15" />
                      {/* Black exclamation text */}
                      <text 
                        x="0" y="4.5" 
                        fill="#1E1B4B" 
                        fontSize="13" 
                        fontWeight="bold" 
                        fontFamily="sans-serif" 
                        textAnchor="middle"
                      >
                        !
                      </text>
                    </motion.g>
                  )}
                </AnimatePresence>

                {/* --- 4E. INTERACTIVE CHARACTER COSTUMES OVERLAYS --- */}
                <AnimatePresence mode="wait">
                  {costume === "chef" && (
                    <motion.g
                      key="chef-costume"
                      initial={{ opacity: 0, scale: 0.8, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                    >
                      {/* Chef Hat */}
                      <g transform="translate(95, 34) rotate(-8) scale(0.95)">
                        <path d="M -22,-8 C -35,-8 -38,-24 -24,-30 C -34,-44 -12,-52 0,-42 C 12,-52 34,-44 24,-30 C 38,-24 35,-8 22,-8 Z" fill="#ffffff" stroke="#4A2502" strokeWidth="1.6" strokeLinejoin="round" />
                        <path d="M -20,4 C -20,-8 20,-8 20,4 C 20,10 -20,10 -20,4 Z" fill="#fcfcfc" stroke="#4A2502" strokeWidth="1.6" strokeLinejoin="round" />
                        <path d="M -10,-8 L -10,-24" stroke="#d5d5d5" strokeWidth="1.2" strokeLinecap="round" />
                        <path d="M 0,-8 L 0,-30" stroke="#d5d5d5" strokeWidth="1.2" strokeLinecap="round" />
                        <path d="M 10,-8 L 10,-24" stroke="#d5d5d5" strokeWidth="1.2" strokeLinecap="round" />
                      </g>
                      {/* Chef French Curly Mustache */}
                      <g transform="translate(100, 104)">
                        <path d="M 0,0 C -6,-5 -14,-4 -17,0 C -20,3 -18,7 -14,6 C -10,5 -4,1 0,0 Z" fill="#4A2502" stroke="#251001" strokeWidth="0.8" />
                        <path d="M 0,0 C 6,-5 14,-4 17,0 C 20,3 18,7 14,6 C 10,5 4,1 0,0 Z" fill="#4A2502" stroke="#251001" strokeWidth="0.8" />
                        <circle cx="0" cy="0" r="1.5" fill="#251001" />
                      </g>
                    </motion.g>
                  )}

                  {costume === "astronaut" && (
                    <motion.g
                      key="astronaut-costume"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    >
                      {/* Antenna on top-right of head (within face space) */}
                      <g transform="translate(142, 44) rotate(25)">
                        <line x1="0" y1="0" x2="0" y2="-22" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" />
                        <ellipse cx="0" cy="0" rx="6" ry="2" fill="#37474f" />
                        {/* Glowing flashing red light */}
                        <motion.circle 
                          cx="0" cy="-22" r="4.5" 
                          fill="#ff1744" 
                          animate={{ opacity: [0.4, 1, 0.4] }} 
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} 
                        />
                      </g>
                      
                      {/* Outer transparent space helmet glass bubble */}
                      <circle cx="100" cy="95" r="82" fill="none" stroke="#e0f7fa" strokeWidth="2.8" strokeDasharray="300" opacity="0.6" />
                      <circle cx="100" cy="95" r="82" fill="url(#glassCore)" opacity="0.12" />
                      
                      {/* Glass reflection streak */}
                      <path d="M 40 45 A 72 72 0 0 1 150 25 A 80 80 0 0 0 40 45 Z" fill="#ffffff" opacity="0.22" />
                      
                      {/* Space mission badge on lower left chest */}
                      <g transform="translate(54, 134) rotate(-15)">
                        <circle cx="0" cy="0" r="7" fill="#0d47a1" stroke="#ffffff" strokeWidth="1" />
                        <path d="M -2,2 L 2,-2 L 3,1 L -1,4 Z" fill="#ff9100" />
                        <path d="M 0,0 L 2,-2 L 1,-4 L -1,-2 Z" fill="#ffffff" />
                      </g>
                    </motion.g>
                  )}

                  {costume === "detective" && (
                    <motion.g
                      key="detective-costume"
                      initial={{ opacity: 0, scale: 0.8, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                    >
                      {/* Sherlock Holmes tweed deerstalker hat */}
                      <g transform="translate(100, 32) scale(0.95)">
                        <path d="M -36,0 C -36,-26 -20,-38 0,-38 C 20,-38 36,-26 36,0 Z" fill="#8D6E63" stroke="#4A2502" strokeWidth="1.6" strokeLinejoin="round" />
                        <path d="M -22,-20 Q 0,-34 22,-20" fill="none" stroke="#5D4037" strokeWidth="1.0" strokeDasharray="2 3" />
                        <path d="M -30,-8 Q 0,-24 30,-8" fill="none" stroke="#5D4037" strokeWidth="1.0" strokeDasharray="2 3" />
                        <line x1="0" y1="-38" x2="0" y2="0" stroke="#5D4037" strokeWidth="1.2" />
                        
                        {/* VISORS / BRIMS */}
                        <path d="M -36,0 C -48,0 -50,6 -34,4 C -22,2 -10,0 0,0" fill="#6D4C41" stroke="#4A2502" strokeWidth="1.6" strokeLinecap="round" />
                        <path d="M 36,0 C 48,0 50,6 34,4 C 22,2 10,0 0,0" fill="#6D4C41" stroke="#4A2502" strokeWidth="1.6" strokeLinecap="round" />
                        
                        {/* Bow knot on top */}
                        <path d="M -8,-38 C -4,-42 4,-42 8,-38 L 4,-34 L -4,-34 Z" fill="#5D4037" stroke="#4A2502" strokeWidth="1.2" />
                        <circle cx="0" cy="-38" r="2.5" fill="#3E2723" />
                      </g>
                      
                      {/* Monocle / Magnifying Glass on Left Eye (x=73, y=94) */}
                      <g transform="translate(73, 94)">
                        <line x1="-10" y1="10" x2="-22" y2="22" stroke="#5D4037" strokeWidth="3.2" strokeLinecap="round" />
                        <line x1="-10" y1="10" x2="-22" y2="22" stroke="#D7CCC8" strokeWidth="1.2" strokeLinecap="round" />
                        <circle cx="-8" cy="8" r="14" fill="#80deea" fillOpacity="0.25" stroke="#ffe082" strokeWidth="1.8" />
                        <path d="M -18 4 A 10 10 0 0 1 -4 18" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
                      </g>
                    </motion.g>
                  )}

                  {costume === "wizard" && (
                    <motion.g
                      key="wizard-costume"
                      initial={{ opacity: 0, scale: 0.8, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      transition={{ type: "spring", stiffness: 110, damping: 13 }}
                    >
                      {/* Wizard Hat */}
                      <g transform="translate(100, 30) rotate(-5) scale(0.95)">
                        <ellipse cx="0" cy="0" rx="46" ry="6" fill="#311B92" stroke="#1A237E" strokeWidth="1.6" />
                        <path d="M -30,-2 C -30,-22 -15,-48 -2,-56 C 8,-61 14,-58 10,-48 C 6,-38 18,-20 30,-2 Z" fill="#311B92" stroke="#1A237E" strokeWidth="1.6" strokeLinejoin="round" />
                        <path d="M -29,-2 C -20,-5 20,-5 29,-2 L 28,2 C 18,0 -18,0 -28,2 Z" fill="#FFD54F" />
                        <g transform="translate(-10, -28) scale(0.4)">
                          <path d="M 0,-10 L 3,-3 L 10,-3 L 5,2 L 7,9 L 0,5 L -7,9 L -5,2 L -10,-3 L -3,-3 Z" fill="#FFD54F" />
                        </g>
                        <g transform="translate(10, -18) scale(0.3)">
                          <path d="M 0,-10 L 3,-3 L 10,-3 L 5,2 L 7,9 L 0,5 L -7,9 L -5,2 L -10,-3 L -3,-3 Z" fill="#FFD54F" />
                        </g>
                        <g transform="translate(-4, -44) scale(0.35)">
                          <path d="M 0,-10 L 3,-3 L 10,-3 L 5,2 L 7,9 L 0,5 L -7,9 L -5,2 L -10,-3 L -3,-3 Z" fill="#FFD54F" />
                        </g>
                      </g>
                      {/* Glowing magic wand */}
                      <g transform="translate(138, 98) rotate(20)">
                        <line x1="0" y1="12" x2="16" y2="-12" stroke="#5D4037" strokeWidth="2.2" strokeLinecap="round" />
                        <line x1="12" y1="-6" x2="16" y2="-12" stroke="#FFF9C4" strokeWidth="2.2" strokeLinecap="round" />
                        <g transform="translate(16, -12) scale(0.55)">
                          <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#FFF59D" filter="url(#goldGlow)" />
                          <path d="M 0,-12 Q 0,0 12,0 Q 0,0 0,12 Q 0,0 -12,0 Q 0,0 0,-12 Z" fill="#FFFFFF" />
                        </g>
                      </g>
                    </motion.g>
                  )}
                </AnimatePresence>
              </motion.g>
            </motion.g>

            {/* --- 4C. HIGH-FIDELITY GLASS SPECULAR REFLECTIONS --- */}
            {/* Specular reflections shift in the OPPOSITE direction of mouse to mimic actual glass physics */}
            <motion.g
              animate={{
                x: mousePos.x * -5.5,
                y: mousePos.y * -3.2,
              }}
              transition={{ type: "spring", stiffness: 75, damping: 18 }}
            >
              {/* Volumetric Refractive Glass Overlay that gives realistic crystal envelope look */}
              <circle cx="100" cy="100" r="95" fill="url(#glassCore)" />

              {/* Giant elegant glossy crescent glass highlight (top-left) */}
              <path d="M 22 55 A 82 82 0 0 1 145 22 A 90 90 0 0 0 22 55 Z" fill="url(#glassReflection)" />
              
              {/* Crisp 3D glass highlight capsules matching the reference photo exactly */}
              <ellipse cx="58" cy="52" rx="14" ry="7" fill="#ffffff" fillOpacity="0.82" transform="rotate(-40 58 52)" />
              <ellipse cx="58" cy="52" rx="20" ry="10" fill="#ffffff" fillOpacity="0.28" transform="rotate(-40 58 52)" />
              
              {/* Extra soft highlight edge reflection along the right/bottom curve */}
              <path d="M 175 65 A 95 95 0 0 1 145 175 A 90 90 0 0 0 165 75 Z" fill="#ffffff" fillOpacity="0.12" />

              {/* Secondary softer bottom-right reflection */}
              <ellipse cx="140" cy="148" rx="40" ry="12" fill="#ffffff" fillOpacity="0.06" transform="rotate(-30 140 148)" />
            </motion.g>

            {/* Floating golden magical sparkles nestled securely within the sphere */}
            <g transform="translate(150, 36) scale(0.65)" className="opacity-80">
              <path d="M 10 0 Q 10 10 20 10 Q 10 10 10 20 Q 10 10 0 10 Q 10 10 10 0 Z" fill="#ffe082" />
            </g>
          </svg>

          {/* Floating interactive sparkles layer in HTML */}
          <div className="absolute top-4 right-4 w-4 h-4 text-amber-200/95 animate-bounce pointer-events-none">
            <Sparkles className="w-3.5 h-3.5 filter drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
          </div>
        </div>
      </motion.div>      {/* 5. FOREGROUND SVG LAYER: THE FRONT HALF OF THE TILTED 3D ORBITS (COMPLETES THE 3D OVERLAP) */}
      <svg viewBox="0 0 500 500" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-30">
        <defs>
          {/* Paths defined specifically for this SVG document scope to animate motion */}
          <path id="orbitPath1Fore" d="M 40,250 a 210,95 0 1,0 420,0 a 210,95 0 1,0 -420,0" fill="none" />
          <path id="orbitPath2Fore" d="M 15,250 a 235,105 0 1,0 470,0 a 235,105 0 1,0 -470,0" fill="none" />
          <path id="orbitPath1TightFore" d="M 120,250 a 130,55 0 1,0 260,0 a 130,55 0 1,0 -260,0" fill="none" />
          <path id="orbitPath2TightFore" d="M 110,250 a 140,62 0 1,0 280,0 a 140,62 0 1,0 -280,0" fill="none" />

          {/* Mask / clip area rendering only the front overlap side of Orbit 1 (the right hemisphere) */}
          <clipPath id="frontClip">
            <rect x="220" y="0" width="280" height="500" />
          </clipPath>
          {/* Mask / clip area rendering only the front overlap side of Orbit 2 (the left hemisphere) */}
          <clipPath id="leftClip">
            <rect x="0" y="0" width="255" height="500" />
          </clipPath>
        </defs>

        {/* --- FAINT OUTER ORBITS FRONT SIDE --- */}
        {/* Orbit 1 Wide Front Side */}
        <g transform="rotate(-15 250 250)" clipPath="url(#frontClip)">
          <ellipse cx="250" cy="250" rx="210" ry="95" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.6" className="opacity-20" />
          {/* Glowing heart badge nestled right on the wide orbit path */}
          <g transform="translate(425, 222) rotate(15) scale(0.85)">
            <path 
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
              fill="url(#goldOrbitWarm)" 
              stroke="#ffffff" 
              strokeWidth="2.0" 
              filter="url(#goldGlow)" 
            />
          </g>
        </g>
        {/* Orbit 2 Wide Front Side */}
        <g transform="rotate(22 250 250)" clipPath="url(#leftClip)">
          <ellipse cx="250" cy="250" rx="235" ry="105" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.5" strokeDasharray="2 4" className="opacity-15" />
        </g>

        {/* --- SHINY TIGHT ORBITS FRONT SIDE (Sweeping across front of mascot) --- */}
        {/* Tight Orbit 1 Front Overlap */}
        <g transform="rotate(-15 250 250)" clipPath="url(#frontClip)">
          <ellipse cx="250" cy="250" rx="130" ry="55" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="2.0" filter="url(#goldGlow)" className="opacity-45" />
          <ellipse cx="250" cy="250" rx="130" ry="55" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.9" className="opacity-95" />

          {/* Synchronized frontside particles (Orbit 1 Tight) */}
          <circle r="2.8" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="0s">
              <mpath href="#orbitPath1TightFore" />
            </animateMotion>
          </circle>
          <circle r="2.2" fill="#ffd54f" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="1.8s">
              <mpath href="#orbitPath1TightFore" />
            </animateMotion>
          </circle>
          <circle r="2.6" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="3.6s">
              <mpath href="#orbitPath1TightFore" />
            </animateMotion>
          </circle>
          {/* Sparkle star front side */}
          <path d="M 0 -5 Q 0 0 5 0 Q 0 0 0 5 Q 0 0 -5 0 Q 0 0 0 -5 Z" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="6s" repeatCount="indefinite" begin="2.7s">
              <mpath href="#orbitPath1TightFore" />
            </animateMotion>
          </path>
        </g>

        {/* Tight Orbit 2 Front Overlap */}
        <g transform="rotate(22 250 250)" clipPath="url(#leftClip)">
          <ellipse cx="250" cy="250" rx="140" ry="62" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="1.8" filter="url(#goldGlow)" className="opacity-35" />
          <ellipse cx="250" cy="250" rx="140" ry="62" fill="none" stroke="url(#goldOrbitWarm)" strokeWidth="0.8" className="opacity-90" />

          {/* Synchronized frontside particles (Orbit 2 Tight) */}
          <circle r="2.4" fill="#ffffff" filter="url(#goldGlow)">
            <animateMotion dur="7.5s" repeatCount="indefinite" begin="0s">
              <mpath href="#orbitPath2TightFore" />
            </animateMotion>
          </circle>
          <circle r="2.0" fill="#ffe082" filter="url(#goldGlow)">
            <animateMotion dur="7.5s" repeatCount="indefinite" begin="3.75s">
              <mpath href="#orbitPath2TightFore" />
            </animateMotion>
          </circle>
        </g>
      </svg>
    </div>
  );
}
