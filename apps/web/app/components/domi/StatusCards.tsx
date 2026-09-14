"use client";

import React from "react";
import { 
  Heart, 
  BookOpen, 
  ShoppingCart, 
  Wind, 
  Check 
} from "lucide-react";
import { ShoppingItem, StudyBlock } from "./domiTypes";

interface StatusCardsProps {
  medicineConfirmed: boolean;
  studyPrepared: boolean;
  shoppingItems: ShoppingItem[];
  studyBlocks: StudyBlock[];
  breathingActive: boolean;
  isMusicPlaying: boolean;
  onReviewCare: () => void;
  onNotifyFamily: () => void;
  onPrepareStudy: () => void;
  onViewStudyPlan: () => void;
  onPrepareShopping: () => void;
  onViewPantry: () => void;
  onStartBreathing: () => void;
  onToggleMusic: () => void;
  activeTheme?: "dawn" | "day" | "sunset" | "night";
  side?: "left" | "right" | "all";
  className?: string;
  /** OPS-1 "partir limpio": en hogar real no hay contenido de ejemplo
   * (Elena/Diego); las tarjetas muestran estados neutros/vacíos. */
  isReal?: boolean;
}

export default function StatusCards({
  medicineConfirmed,
  studyPrepared,
  shoppingItems,
  breathingActive,
  isMusicPlaying,
  onReviewCare,
  onNotifyFamily,
  onPrepareStudy,
  onViewStudyPlan,
  onPrepareShopping,
  onViewPantry,
  onStartBreathing,
  onToggleMusic,
  activeTheme = "night",
  side = "all",
  className = "",
  isReal = false
}: StatusCardsProps) {

  const activeShoppingCount = shoppingItems.filter(item => !item.checked).length;
  const isLight = activeTheme === "dawn" || activeTheme === "day";
  // En hogar real y sin datos, cuidado/estudio se muestran en calma (sin el
  // glow rojo/azul de "pendiente", que sería una alarma falsa).
  const careCalm = medicineConfirmed || isReal;
  const studyCalm = studyPrepared || isReal;

  // 1. CUIDADO CARD
  const cuidadoCard = (
    <div className={`status-card-item rounded-3xl p-4 xl:p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full border ${
      isLight 
        ? "bg-white/85 border-slate-200/60 shadow-sm shadow-slate-100/20 backdrop-blur-md text-slate-800" 
        : `glass-panel ${careCalm ? "border-rose-500/10" : "glow-red border-rose-500/20"}`
    }`}>
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center gap-3 mb-2 xl:mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
          careCalm
            ? (isLight ? "border-slate-200 text-slate-400 bg-slate-50" : "border-slate-800 text-slate-400 bg-slate-900/50")
            : (isLight ? "border-rose-300 text-rose-600 bg-rose-50" : "border-rose-500/30 text-rose-400 bg-rose-500/10")
        }`}>
          <Heart className={`w-4.5 h-4.5 ${!careCalm && "animate-pulse"}`} />
        </div>
        <div>
          <span className="block text-[11px] font-bold text-rose-500 uppercase tracking-wider font-mono">CUIDADO</span>
          <h4 className={`text-sm xl:text-sm font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>{isReal ? "Cuidado del hogar" : "Cuidado de Elena"}</h4>
        </div>
      </div>

      {/* Card Body */}
      <p className={`text-[13px] xl:text-sm leading-relaxed mb-3 xl:mb-4 min-h-[36px] line-clamp-3 md:line-clamp-none ${isLight ? "text-slate-700" : "text-slate-300"}`}>
        {isReal && !medicineConfirmed ? (
          "Sin recordatorios de cuidado pendientes."
        ) : medicineConfirmed ? (
          <span className="flex items-start gap-1.5 text-emerald-600 font-medium">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Medicamento confirmado hoy por la familia.</span>
          </span>
        ) : (
          "Medicamento nocturno pendiente. Se requiere confirmación familiar."
        )}
      </p>

      {/* Card Actions */}
      <div className="flex flex-col gap-1.5 mt-auto">
        <button 
          onClick={onReviewCare}
          className={`w-full py-1.5 px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 border cursor-pointer ${
            medicineConfirmed 
              ? (isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200" : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800") 
              : (isLight ? "bg-gradient-to-r from-rose-50 to-orange-50 hover:from-rose-100 hover:to-orange-100 text-rose-700 border-rose-200/70 shadow-sm" : "bg-gradient-to-r from-rose-500/30 to-orange-500/30 hover:from-rose-500/40 hover:to-orange-500/40 text-rose-200 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]")
          }`}
        >
          {medicineConfirmed ? "Historial" : "Revisar cuidado"}
        </button>
        <button 
          onClick={onNotifyFamily}
          className={`w-full py-1 text-xs font-medium transition-colors text-center cursor-pointer ${
            isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Avisar a la familia
        </button>
      </div>
    </div>
  );

  // 2. ESTUDIO CARD
  const estudioCard = (
    <div className={`status-card-item rounded-3xl p-4 xl:p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full border ${
      isLight 
        ? "bg-white/85 border-slate-200/60 shadow-sm shadow-slate-100/20 backdrop-blur-md text-slate-800" 
        : `glass-panel ${studyCalm ? "border-blue-500/10" : "glow-blue border-blue-500/20"}`
    }`}>
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center gap-3 mb-2 xl:mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
          studyCalm
            ? (isLight ? "border-slate-200 text-slate-400 bg-slate-50" : "border-slate-800 text-slate-400 bg-slate-900/50")
            : (isLight ? "border-blue-300 text-blue-600 bg-blue-50" : "border-blue-500/30 text-blue-400 bg-blue-500/10")
        }`}>
          <BookOpen className="w-4.5 h-4.5" />
        </div>
        <div>
          <span className="block text-[11px] font-bold text-blue-500 uppercase tracking-wider font-mono">ESTUDIO</span>
          <h4 className={`text-sm xl:text-sm font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>Estudio en casa</h4>
        </div>
      </div>

      {/* Card Body */}
      <p className={`text-[13px] xl:text-sm leading-relaxed mb-3 xl:mb-4 min-h-[36px] line-clamp-3 md:line-clamp-none ${isLight ? "text-slate-700" : "text-slate-300"}`}>
        {isReal && !studyPrepared ? (
          "Sube un aviso escolar y Domi arma el plan de estudio."
        ) : studyPrepared ? (
          <span className="flex items-start gap-1.5 text-emerald-600 font-medium">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{isReal ? "Plan de estudio preparado." : "Domi organizó 3 bloques de repaso para Diego. Listo."}</span>
          </span>
        ) : (
          "Examen el lunes. Domi puede crear bloques de repaso y un paquete."
        )}
      </p>

      {/* Card Actions */}
      <div className="flex flex-col gap-1.5 mt-auto">
        <button 
          onClick={onPrepareStudy}
          className={`w-full py-1.5 px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 border cursor-pointer ${
            studyPrepared 
              ? (isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200" : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800") 
              : (isLight ? "bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 border-blue-200/70 shadow-sm" : "bg-gradient-to-r from-blue-500/30 to-indigo-500/30 hover:from-blue-500/40 hover:to-indigo-500/40 text-blue-200 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]")
          }`}
        >
          {studyPrepared ? "Reorganizar plan" : "Preparar estudio"}
        </button>
        <button 
          onClick={onViewStudyPlan}
          className={`w-full py-1 text-xs font-medium transition-colors text-center cursor-pointer ${
            isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Ver plan de estudio
        </button>
      </div>
    </div>
  );

  // 3. COMPRAS CARD
  const comprasCard = (
    <div className={`status-card-item rounded-3xl p-4 xl:p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full border ${
      isLight 
        ? "bg-white/85 border-slate-200/60 shadow-sm shadow-slate-100/20 backdrop-blur-md text-slate-800" 
        : `glass-panel ${activeShoppingCount === 0 ? "border-emerald-500/10" : "glow-green border-emerald-500/20"}`
    }`}>
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
      
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-2 xl:mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
          isLight ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
        }`}>
          <ShoppingCart className="w-4.5 h-4.5" />
        </div>
        <div>
          <span className="block text-[11px] font-bold text-emerald-500 uppercase tracking-wider font-mono">COMPRAS</span>
          <h4 className={`text-sm xl:text-sm font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>Compras del hogar</h4>
        </div>
      </div>

      {/* Card Body */}
      <p className={`text-[13px] xl:text-sm leading-relaxed mb-3 xl:mb-4 min-h-[36px] line-clamp-3 md:line-clamp-none ${isLight ? "text-slate-700" : "text-slate-300"}`}>
        {activeShoppingCount === 0 ? (
          <span className="flex items-start gap-1.5 text-emerald-600 font-medium">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Despensa completa. No hay productos pendientes.</span>
          </span>
        ) : (
          `Faltan ${activeShoppingCount} productos. Domi los organiza por lugar.`
        )}
      </p>

      {/* Card Actions */}
      <div className="flex flex-col gap-1.5 mt-auto">
        <button 
          onClick={onPrepareShopping}
          className={`w-full py-1.5 px-3 rounded-xl text-[13px] font-semibold border transition-all duration-200 cursor-pointer ${
            isLight 
              ? "bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-700 border-emerald-200/70 shadow-sm" 
              : "bg-gradient-to-r from-emerald-500/30 to-teal-500/30 hover:from-emerald-500/40 hover:to-teal-500/40 text-emerald-200 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          }`}
        >
          Preparar compras
        </button>
        <button 
          onClick={onViewPantry}
          className={`w-full py-1 text-xs font-medium transition-colors text-center cursor-pointer ${
            isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Ver lista y despensa
        </button>
      </div>
    </div>
  );

  // 4. BIENESTAR CARD
  const bienestarCard = (
    <div className={`status-card-item rounded-3xl p-4 xl:p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full border ${
      isLight 
        ? "bg-white/85 border-slate-200/60 shadow-sm shadow-slate-100/20 backdrop-blur-md text-slate-800" 
        : `glass-panel ${breathingActive ? "glow-purple border-purple-500/30" : "border-slate-800"}`
    }`}>
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
      
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-2 xl:mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
          breathingActive 
            ? "border-purple-500 text-purple-600 bg-purple-50 animate-pulse" 
            : (isLight ? "border-purple-200 text-purple-600 bg-purple-50" : "border-purple-500/30 text-purple-400 bg-purple-500/10")
        }`}>
          <Wind className={`w-4.5 h-4.5 ${breathingActive && "animate-spin-slow"}`} />
        </div>
        <div>
          <span className="block text-[11px] font-bold text-purple-500 uppercase tracking-wider font-mono">BIENESTAR</span>
          <h4 className={`text-sm xl:text-sm font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>Un momento de calma</h4>
        </div>
      </div>

      {/* Card Body */}
      <p className={`text-[13px] xl:text-sm leading-relaxed mb-3 xl:mb-4 min-h-[36px] line-clamp-3 md:line-clamp-none ${
        isLight 
          ? (breathingActive ? "text-purple-700 font-semibold" : "text-slate-700") 
          : (breathingActive ? "text-purple-300 font-medium" : "text-slate-300")
      }`}>
        {breathingActive ? (
          <span className="animate-pulse">
            Ejercicio de respiración activo. Inhala y exhala con Domi...
          </span>
        ) : (
          "Inicia un ejercicio de respiración o música tranquila de fondo."
        )}
      </p>

      {/* Card Actions */}
      <div className="flex flex-col gap-1.5 mt-auto">
        <button 
          onClick={onStartBreathing}
          className={`w-full py-1.5 px-3 rounded-xl text-[13px] font-semibold border transition-all duration-200 cursor-pointer ${
            breathingActive 
              ? "bg-red-500/20 border border-red-500/35 text-red-600 hover:text-red-700" 
              : (isLight ? "bg-gradient-to-r from-purple-50 to-fuchsia-50 hover:from-purple-100 hover:to-fuchsia-100 text-purple-700 border-purple-200/70 shadow-sm" : "bg-gradient-to-r from-purple-500/30 to-fuchsia-500/30 hover:from-purple-500/40 hover:to-fuchsia-500/40 text-purple-200 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]")
          }`}
        >
          {breathingActive ? "Detener ejercicio" : "Respirar 1 minuto"}
        </button>
        <button 
          onClick={onToggleMusic}
          className={`w-full py-1 text-xs font-medium transition-all text-center rounded-lg cursor-pointer ${
            isMusicPlaying 
              ? (isLight ? "text-purple-700 bg-purple-50 border border-purple-100/60" : "text-purple-300 bg-purple-500/10 border border-purple-500/20") 
              : (isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200")
          }`}
        >
          {isMusicPlaying ? "Pausar música" : "Música tranquila"}
        </button>
      </div>
    </div>
  );

  if (side === "left") {
    return (
      <div className={`flex flex-col gap-4 w-full h-full ${className}`}>
        <div className="flex-1 min-h-[190px] flex flex-col">
          {cuidadoCard}
        </div>
        <div className="flex-1 min-h-[190px] flex flex-col">
          {estudioCard}
        </div>
      </div>
    );
  }

  if (side === "right") {
    return (
      <div className={`flex flex-col gap-4 w-full h-full ${className}`}>
        <div className="flex-1 min-h-[190px] flex flex-col">
          {comprasCard}
        </div>
        <div className="flex-1 min-h-[190px] flex flex-col">
          {bienestarCard}
        </div>
      </div>
    );
  }

  return (
    <div id="status-cards-grid" className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 w-full overflow-visible z-10 ${className}`}>
      {cuidadoCard}
      {estudioCard}
      {comprasCard}
      {bienestarCard}
    </div>
  );
}
