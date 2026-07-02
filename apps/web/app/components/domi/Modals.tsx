"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "./domiMotion";
import { 
  X, 
  Check, 
  Plus, 
  Trash2, 
  Sparkles, 
  Heart, 
  BookOpen, 
  ShoppingCart, 
  Users, 
  ChevronRight, 
  Smile,
  ShieldCheck,
  Award
} from "lucide-react";
import { ShoppingItem, StudyBlock, FamilyMember } from "./domiTypes";

interface ModalsProps {
  // States
  showCare: boolean;
  showStudy: boolean;
  showShopping: boolean;
  showFamily: boolean;
  showSummary: boolean;
  
  // State variables
  medicineConfirmed: boolean;
  studyPrepared: boolean;
  shoppingItems: ShoppingItem[];
  studyBlocks: StudyBlock[];
  familyMembers: FamilyMember[];
  medicineLogs: { time: string; confirmedBy: string }[];
  activeTheme?: "dawn" | "day" | "sunset" | "night";

  // Setters/Triggers
  onCloseAll: () => void;
  onConfirmMedicine: (confirmed: boolean, loggerName?: string) => void;
  onToggleShoppingItem: (id: string) => void;
  onAddShoppingItem: (name: string, qty: string, category: string) => void;
  onDeleteShoppingItem: (id: string) => void;
  onUpdateFamilyStatus: (id: string, status: string) => void;
  onPrepareStudy: () => void;
}

const modalThemes = {
  dawn: {
    overlay: "bg-orange-950/20 backdrop-blur-md",
    panel: "bg-white/95 border-amber-500/25 shadow-xl shadow-amber-200/40 text-slate-800",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.12)]",
    headerBorder: "border-amber-500/10",
    titleText: "text-slate-800",
    subText: "text-slate-500",
    closeBtn: "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
    cardBg: "bg-amber-50/50 border-amber-500/15",
    cardTitle: "text-slate-700",
    cardDesc: "text-slate-600",
    inputBg: "bg-white border-amber-500/15 text-slate-800 placeholder-slate-400 focus:border-amber-500/40 focus:bg-white",
    listBg: "bg-amber-50/20 border-amber-500/10 divide-amber-100/50",
    listItemBg: "bg-white/75 border-amber-500/10 text-slate-700",
    listItemChecked: "bg-slate-50/60 border-slate-200/50 text-slate-400",
    checkboxBg: "border-slate-300 bg-white hover:border-amber-500/40",
    checkboxChecked: "bg-amber-500/10 border-amber-500 text-amber-600",
    buttonSec: "bg-slate-100 hover:bg-slate-200 text-slate-750 border border-slate-200",
    footerBox: "bg-amber-50/30 border-amber-500/10 text-slate-700",
    accentGlow: "glow-amber"
  },
  day: {
    overlay: "bg-sky-950/20 backdrop-blur-md",
    panel: "bg-white/95 border-sky-500/20 shadow-xl shadow-sky-200/40 text-slate-800",
    glow: "shadow-[0_0_40px_rgba(14,165,233,0.12)]",
    headerBorder: "border-sky-500/10",
    titleText: "text-slate-800",
    subText: "text-slate-500",
    closeBtn: "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
    cardBg: "bg-sky-50/50 border-sky-500/15",
    cardTitle: "text-slate-700",
    cardDesc: "text-slate-600",
    inputBg: "bg-white border-sky-500/15 text-slate-800 placeholder-slate-400 focus:border-sky-500/40 focus:bg-white",
    listBg: "bg-sky-50/20 border-sky-500/10 divide-sky-100/50",
    listItemBg: "bg-white/75 border-sky-500/10 text-slate-700",
    listItemChecked: "bg-slate-50/60 border-slate-200/50 text-slate-400",
    checkboxBg: "border-slate-300 bg-white hover:border-sky-500/40",
    checkboxChecked: "bg-sky-500/10 border-sky-500 text-sky-600",
    buttonSec: "bg-slate-100 hover:bg-slate-200 text-slate-750 border border-slate-200",
    footerBox: "bg-sky-50/30 border-sky-500/10 text-slate-700",
    accentGlow: "glow-sky"
  },
  sunset: {
    overlay: "bg-purple-950/70 backdrop-blur-md",
    panel: "bg-slate-950/95 border-rose-500/20 shadow-2xl shadow-rose-950/50 text-slate-200",
    glow: "shadow-[0_0_50px_rgba(244,63,94,0.18)]",
    headerBorder: "border-rose-500/15",
    titleText: "text-slate-100",
    subText: "text-slate-400",
    closeBtn: "text-slate-400 hover:text-slate-200 hover:bg-slate-900",
    cardBg: "bg-slate-900/60 border-rose-500/15",
    cardTitle: "text-slate-200",
    cardDesc: "text-slate-400",
    inputBg: "bg-slate-900 border-rose-500/15 text-slate-100 placeholder-slate-500 focus:border-rose-500/40 focus:bg-slate-900",
    listBg: "bg-slate-950/50 border-rose-500/10 divide-slate-900/80",
    listItemBg: "bg-slate-900/40 border-rose-500/10 text-slate-200",
    listItemChecked: "bg-slate-950/30 border-slate-900 text-slate-500",
    checkboxBg: "border-slate-700 bg-slate-950 hover:border-rose-500/40",
    checkboxChecked: "bg-rose-500/10 border-rose-500 text-rose-400",
    buttonSec: "bg-slate-900 hover:bg-slate-800 text-rose-200 border border-rose-500/20",
    footerBox: "bg-slate-950 border-rose-500/10 text-slate-300",
    accentGlow: "glow-rose"
  },
  night: {
    overlay: "bg-slate-950/75 backdrop-blur-md",
    panel: "bg-slate-950/95 border-amber-500/15 shadow-2xl shadow-amber-950/30 text-slate-200",
    glow: "shadow-[0_0_50px_rgba(245,158,11,0.12)]",
    headerBorder: "border-amber-500/15",
    titleText: "text-slate-100",
    subText: "text-slate-400",
    closeBtn: "text-slate-400 hover:text-slate-200 hover:bg-slate-900",
    cardBg: "bg-slate-900/60 border-amber-500/15",
    cardTitle: "text-slate-200",
    cardDesc: "text-slate-400",
    inputBg: "bg-slate-900 border-amber-500/15 text-slate-100 placeholder-slate-500 focus:border-amber-500/40 focus:bg-slate-900",
    listBg: "bg-slate-950/50 border-amber-500/10 divide-slate-900/80",
    listItemBg: "bg-slate-900/40 border-amber-500/10 text-slate-200",
    listItemChecked: "bg-slate-950/30 border-slate-900 text-slate-500",
    checkboxBg: "border-slate-700 bg-slate-950 hover:border-amber-500/40",
    checkboxChecked: "bg-amber-500/10 border-amber-500 text-amber-400",
    buttonSec: "bg-slate-900 hover:bg-slate-800 text-amber-200 border border-amber-500/20",
    footerBox: "bg-slate-950 border-amber-500/10 text-slate-300",
    accentGlow: "glow-gold"
  }
};

export default function Modals({
  showCare,
  showStudy,
  showShopping,
  showFamily,
  showSummary,
  medicineConfirmed,
  studyPrepared,
  shoppingItems,
  studyBlocks,
  familyMembers,
  medicineLogs,
  activeTheme,
  onCloseAll,
  onConfirmMedicine,
  onToggleShoppingItem,
  onAddShoppingItem,
  onDeleteShoppingItem,
  onUpdateFamilyStatus,
  onPrepareStudy
}: ModalsProps) {

  const currentTheme = activeTheme || "night";
  const isLight = currentTheme === "dawn" || currentTheme === "day";
  const cfg = modalThemes[currentTheme];

  // For adding shopping item
  const [newShopName, setNewShopName] = useState("");
  const [newShopQty, setNewShopQty] = useState("1 ud");
  const [newShopCat, setNewShopCat] = useState("Supermercado");

  // For flashcards in Diego's study plan
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const flashcards = [
    { q: "¿Cuál es el área de un círculo de radio r?", a: "Área = π * r²" },
    { q: "Resuelve: 3x - 7 = 11", a: "3x = 18 => x = 6" },
    { q: "Teorema de Pitágoras para lados a, b e hipotenusa c:", a: "a² + b² = c²" },
    { q: "¿Cuál es la derivada de x²?", a: "La derivada es 2x" }
  ];

  return (
    <AnimatePresence>
      
      {/* 1. CUIDADO DE ELENA MODAL */}
      {showCare && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${cfg.overlay}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`w-full max-w-lg rounded-3xl overflow-hidden p-6 relative border ${cfg.panel} ${cfg.glow}`}
          >
            <div className={`flex items-center justify-between border-b ${cfg.headerBorder} pb-4 mb-4`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold font-display ${cfg.titleText}`}>Cuidado de Elena</h3>
                  <p className={`text-[10px] font-mono ${cfg.subText}`}>Control de salud familiar activa</p>
                </div>
              </div>
              <button onClick={onCloseAll} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${cfg.closeBtn}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Prescriptions cards */}
              <div className={`p-4 rounded-2xl border ${cfg.cardBg}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-[9px] text-rose-400 font-mono font-bold">DOSIS NOCTURNA</span>
                  <span className={`text-[10px] font-mono ${isLight ? "text-amber-600 font-semibold" : "text-amber-400"}`}>Programado: 21:30</span>
                </div>
                <h4 className={`text-sm font-semibold ${cfg.cardTitle}`}>Metformina (850mg) + Complejo B</h4>
                <p className={`text-xs mt-1 ${cfg.cardDesc}`}>Tomar con abundante agua después de la cena ligera. No suspender.</p>
              </div>

              {/* Confirm state */}
              <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center py-6 ${cfg.cardBg}`}>
                {medicineConfirmed ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                      <Check className="w-6 h-6" />
                    </div>
                    <h4 className={`text-sm font-semibold ${isLight ? "text-emerald-600" : "text-emerald-400"}`}>¡Medicamento Confirmado!</h4>
                    <p className={`text-xs px-4 ${cfg.cardDesc}`}>La dosis ya ha sido reportada por un familiar. Domi ha cerrado la alerta nocturna.</p>
                    <button 
                      onClick={() => onConfirmMedicine(false)}
                      className="mt-2 text-[10px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Deshacer confirmación
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30 animate-pulse">
                      <Heart className="w-6 h-6" />
                    </div>
                    <h4 className={`text-sm font-semibold ${cfg.cardTitle}`}>¿Elena ya tomó su dosis?</h4>
                    <p className={`text-xs px-6 ${cfg.cardDesc}`}>Confirma para registrar la toma de medicamentos en el historial y avisar al núcleo familiar.</p>
                    
                    <div className="flex gap-2 justify-center pt-2">
                      <button 
                        onClick={() => onConfirmMedicine(true, "Mamá")}
                        className="py-2 px-5 rounded-xl text-xs bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all cursor-pointer"
                      >
                        Confirmar Toma (Mamá)
                      </button>
                      <button 
                        onClick={() => onConfirmMedicine(true, "Papá")}
                        className={`py-2 px-5 rounded-xl text-xs transition-all cursor-pointer ${cfg.buttonSec}`}
                      >
                        Confirmar Toma (Papá)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* History list */}
              <div>
                <h5 className={`text-[11px] font-bold uppercase tracking-wider mb-2 font-mono ${cfg.subText}`}>Registro de hoy</h5>
                <div className={`rounded-xl border divide-y max-h-[110px] overflow-y-auto no-scrollbar ${cfg.listBg}`}>
                  {medicineLogs.length === 0 ? (
                    <div className={`p-3 text-center text-xs italic ${cfg.subText}`}>No hay registros cargados hoy.</div>
                  ) : (
                    medicineLogs.map((log, i) => (
                      <div key={i} className="p-3 flex justify-between items-center text-xs">
                        <span className={`font-medium ${cfg.cardTitle}`}>Dosis nocturna confirmada</span>
                        <div className={`flex items-center gap-2 font-mono text-[10px] ${cfg.subText}`}>
                          <span>Por {log.confirmedBy}</span>
                          <span>•</span>
                          <span>{log.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 2. ESTUDIO EN CASA MODAL */}
      {showStudy && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${cfg.overlay}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`w-full max-w-lg rounded-3xl overflow-hidden p-6 relative border ${cfg.panel} ${cfg.glow}`}
          >
            <div className={`flex items-center justify-between border-b ${cfg.headerBorder} pb-4 mb-4`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold font-display ${cfg.titleText}`}>Estudio de Diego</h3>
                  <p className={`text-[10px] font-mono ${cfg.subText}`}>Prueba de Matemáticas el lunes</p>
                </div>
              </div>
              <button onClick={onCloseAll} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${cfg.closeBtn}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Prepared status indicator banner */}
              <div className={`p-3.5 rounded-2xl border text-xs flex justify-between items-center ${
                studyPrepared 
                  ? (isLight ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300") 
                  : (isLight ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-amber-500/10 border-amber-500/20 text-amber-300")
              }`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin-slow" />
                  <span className="font-medium">{studyPrepared ? "Plan de estudio estructurado y preparado por Domi" : "Plan de estudio pendiente de preparación por IA"}</span>
                </div>
                {!studyPrepared && (
                  <button 
                    onClick={onPrepareStudy}
                    className="py-1 px-3 text-[10px] bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    Generar Bloques
                  </button>
                )}
              </div>

              {/* Study Blocks list */}
              <div>
                <h5 className={`text-[11px] font-bold uppercase tracking-wider mb-2 font-mono ${cfg.subText}`}>Bloques de repaso recomendados</h5>
                <div className="space-y-2">
                  {studyBlocks.map((block) => (
                    <div key={block.id} className={`p-3 rounded-xl border flex items-center justify-between ${cfg.listItemBg}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold border ${
                          isLight ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-950/80 text-blue-300 border-slate-800/80"
                        }`}>
                          {block.duration}
                        </div>
                        <div>
                          <h4 className={`text-xs font-semibold ${cfg.cardTitle}`}>{block.subject}</h4>
                          <span className={`text-[10px] ${cfg.subText}`}>Bloque sugerido por Domi</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        isLight ? "bg-slate-100 border-slate-250 text-slate-600" : "bg-slate-950/50 border-slate-900/80 text-slate-400"
                      }`}>{block.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Math Interactive flashcards block (Premium micro-experience) */}
              <div className={`p-4 rounded-2xl border ${cfg.cardBg}`}>
                <div className={`flex justify-between items-center mb-2 pb-1.5 border-b ${isLight ? "border-amber-500/10" : "border-slate-900"}`}>
                  <span className={`text-[10px] font-mono flex items-center gap-1 ${cfg.subText}`}>
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    Tarjetas de práctica rápida
                  </span>
                  <span className={`text-[10px] font-mono ${cfg.subText}`}>{activeCardIndex + 1} de {flashcards.length}</span>
                </div>

                {/* Flip Card animation container */}
                <div 
                  onClick={() => setIsCardFlipped(!isCardFlipped)}
                  className={`h-24 rounded-xl border flex flex-col items-center justify-center p-3 text-center cursor-pointer relative overflow-hidden group select-none transition-all ${
                    isLight 
                      ? "bg-white hover:bg-slate-50/80 border-amber-500/15 shadow-inner" 
                      : "bg-slate-900/80 hover:bg-slate-900/90 border-slate-800/80"
                  }`}
                >
                  <span className={`absolute right-2 top-2 text-[8px] font-mono uppercase tracking-wider transition-colors ${
                    isLight ? "text-slate-400 group-hover:text-blue-500" : "text-slate-500 group-hover:text-blue-400"
                  }`}>Clic para girar</span>
                  {isCardFlipped ? (
                    <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} className={`font-medium text-xs font-mono ${isLight ? "text-emerald-600 font-bold" : "text-emerald-300"}`}>
                      {flashcards[activeCardIndex].a}
                    </motion.div>
                  ) : (
                    <motion.div initial={{ rotateY: -90 }} animate={{ rotateY: 0 }} className={`font-semibold text-xs leading-relaxed max-w-[90%] ${cfg.cardTitle}`}>
                      {flashcards[activeCardIndex].q}
                    </motion.div>
                  )}
                </div>

                {/* Card controls */}
                <div className="flex justify-between mt-3">
                  <button 
                    disabled={activeCardIndex === 0}
                    onClick={(e) => { e.stopPropagation(); setActiveCardIndex(p => p - 1); setIsCardFlipped(false); }}
                    className={`text-[10px] disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                      isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Anterior
                  </button>
                  <button 
                    disabled={activeCardIndex === flashcards.length - 1}
                    onClick={(e) => { e.stopPropagation(); setActiveCardIndex(p => p + 1); setIsCardFlipped(false); }}
                    className={`text-[10px] disabled:opacity-30 disabled:pointer-events-none hover:underline cursor-pointer ${
                      isLight ? "text-blue-600 hover:text-blue-700 font-semibold" : "text-blue-400 hover:text-blue-300"
                    }`}
                  >
                    Siguiente tarjeta
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 3. COMPRAS DEL HOGAR MODAL */}
      {showShopping && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${cfg.overlay}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`w-full max-w-lg rounded-3xl overflow-hidden p-6 relative border ${cfg.panel} ${cfg.glow}`}
          >
            <div className={`flex items-center justify-between border-b ${cfg.headerBorder} pb-4 mb-4`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold font-display ${cfg.titleText}`}>Lista de Compras</h3>
                  <p className={`text-[10px] font-mono ${cfg.subText}`}>Domi organiza por lugar de compra</p>
                </div>
              </div>
              <button onClick={onCloseAll} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${cfg.closeBtn}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add item form inline */}
            <div className="grid grid-cols-12 gap-2 mb-4">
              <input 
                type="text" 
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="Nombre del producto... (ej: Leche)"
                className={`col-span-5 border rounded-xl p-2.5 text-xs outline-none focus:border-emerald-500/40 ${cfg.inputBg}`}
              />
              <input 
                type="text" 
                value={newShopQty}
                onChange={(e) => setNewShopQty(e.target.value)}
                placeholder="Cant... (ej: 2 L)"
                className={`col-span-3 border rounded-xl p-2.5 text-xs outline-none focus:border-emerald-500/40 ${cfg.inputBg}`}
              />
              <select 
                value={newShopCat}
                onChange={(e) => setNewShopCat(e.target.value)}
                className={`col-span-3 border rounded-xl p-2.5 text-xs outline-none cursor-pointer focus:border-emerald-500/40 ${cfg.inputBg}`}
              >
                <option value="Supermercado">Súper</option>
                <option value="Panadería">Panadería</option>
                <option value="Farmacia">Farmacia</option>
                <option value="Frutería">Frutería</option>
              </select>
              <button 
                onClick={() => {
                  if (!newShopName.trim()) return;
                  onAddShoppingItem(newShopName, newShopQty, newShopCat);
                  setNewShopName("");
                }}
                className="col-span-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl flex items-center justify-center transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Items categories list */}
            <div className="max-h-[250px] overflow-y-auto no-scrollbar space-y-4">
              {/* Group items by category */}
              {["Supermercado", "Frutería", "Panadería", "Farmacia"].map((cat) => {
                const catItems = shoppingItems.filter(i => i.category === cat);
                if (catItems.length === 0) return null;

                return (
                  <div key={cat}>
                    <h5 className={`text-[10px] font-bold uppercase tracking-widest font-mono mb-2 ${isLight ? "text-emerald-600" : "text-emerald-400"}`}>{cat}</h5>
                    <div className="space-y-1.5">
                      {catItems.map((item) => (
                        <div 
                          key={item.id} 
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                            item.checked ? cfg.listItemChecked : cfg.listItemBg
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => onToggleShoppingItem(item.id)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                                item.checked ? cfg.checkboxChecked : cfg.checkboxBg
                              }`}
                            >
                              {item.checked && <Check className="w-3.5 h-3.5" />}
                            </button>
                            <span className={`text-xs ${item.checked ? "line-through text-slate-400" : isLight ? "text-slate-800 font-semibold" : "text-slate-200 font-medium"}`}>
                              {item.name} <span className={`text-[10px] font-mono ml-1 ${isLight ? "text-slate-400" : "text-slate-500"}`}>({item.qty})</span>
                            </span>
                          </div>
                          
                          <button 
                            onClick={() => onDeleteShoppingItem(item.id)}
                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                              isLight ? "text-slate-400 hover:text-red-500 hover:bg-slate-100" : "text-slate-500 hover:text-red-400 hover:bg-slate-800"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {shoppingItems.length === 0 && (
                <div className={`py-8 text-center text-xs italic ${cfg.subText}`}>No hay productos en la lista. ¡La despensa está completa!</div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* 4. NUCLEO FAMILIAR MODAL */}
      {showFamily && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${cfg.overlay}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`w-full max-w-lg rounded-3xl overflow-hidden p-6 relative border ${cfg.panel} ${cfg.glow}`}
          >
            <div className={`flex items-center justify-between border-b ${cfg.headerBorder} pb-4 mb-4`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold font-display ${cfg.titleText}`}>Núcleo Familiar</h3>
                  <p className={`text-[10px] font-mono ${cfg.subText}`}>Conexión, ubicación y estatus de tu hogar</p>
                </div>
              </div>
              <button onClick={onCloseAll} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${cfg.closeBtn}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Members status cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {familyMembers.map((member) => (
                  <div key={member.id} className={`p-4 rounded-2xl border flex flex-col justify-between h-[110px] ${cfg.cardBg}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-bold relative ${
                        isLight 
                          ? "bg-slate-100 text-slate-800 border-slate-200" 
                          : "bg-slate-950 text-slate-200 border-slate-700"
                      }`}>
                        {member.avatar.startsWith("http") ? (
                          <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          member.avatar
                        )}
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 rounded-full ${isLight ? "border-white" : "border-slate-950"}`} />
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold leading-tight ${cfg.cardTitle}`}>{member.name}</h4>
                        <span className={`text-[9px] font-mono ${cfg.cardDesc}`}>{member.role}</span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <input 
                        type="text"
                        value={member.status}
                        onChange={(e) => onUpdateFamilyStatus(member.id, e.target.value)}
                        className={`w-full border rounded-lg p-1.5 text-[10px] outline-none ${
                          isLight 
                            ? "bg-white border-slate-250 text-amber-700 placeholder-slate-400 focus:border-amber-500/30" 
                            : "bg-slate-950/80 border-slate-900 focus:border-amber-500/30 text-amber-300 placeholder-slate-600"
                        }`}
                        placeholder="Escribe un estado..."
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Shared family notice board */}
              <div className={`p-4 rounded-2xl border ${cfg.cardBg}`}>
                <h5 className={`text-[10px] font-bold uppercase tracking-widest font-mono mb-2 flex items-center gap-1.5 ${isLight ? "text-amber-600" : "text-amber-400"}`}>
                  <Smile className="w-3.5 h-3.5 text-amber-500" />
                  Muro de Notas del Hogar
                </h5>
                <p className={`text-xs italic leading-relaxed ${cfg.cardDesc}`}>
                  "Recuerden que el fin de semana cenamos en casa de los abuelos. Diego tiene fútbol el sábado a las 10:00."
                </p>
                <span className={`block text-[8px] font-mono mt-1 text-right ${cfg.subText}`}>— Escrito por Papá hace 2 horas</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 5. VER RESUMEN DEL DIA MODAL */}
      {showSummary && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${cfg.overlay}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`w-full max-w-lg rounded-3xl overflow-hidden p-6 relative border ${cfg.panel} ${cfg.glow}`}
          >
            <div className={`flex items-center justify-between border-b ${cfg.headerBorder} pb-4 mb-4`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <h3 className={`text-base font-bold font-display ${cfg.titleText}`}>Resumen del Día de Domi</h3>
                  <p className={`text-[10px] font-mono ${cfg.subText}`}>Generado de forma autónoma por IA</p>
                </div>
              </div>
              <button onClick={onCloseAll} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${cfg.closeBtn}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`space-y-4 text-xs leading-relaxed ${cfg.cardDesc}`}>
              <p className={`font-sans ${cfg.cardTitle}`}>
                ¡Hola! Aquí tienes el resumen ejecutivo de la dinámica de hoy en el hogar. Todo fluye de forma equilibrada y en calma:
              </p>

              <div className="space-y-2.5">
                <div className={`p-3 rounded-xl border flex items-start gap-3 ${cfg.listItemBg}`}>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className={`block font-semibold ${cfg.cardTitle}`}>Salud & Cuidado de Elena</strong>
                    <span>Dosis de medicamento confirmada por la familia hoy en la noche. No hay pendientes de salud registrados.</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border flex items-start gap-3 ${cfg.listItemBg}`}>
                  {studyPrepared ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className={`block font-semibold ${cfg.cardTitle}`}>Estudios de Diego</strong>
                    <span>{studyPrepared ? "Bloques de repaso de matemáticas organizados. Diego completará 1.5 horas de estudio focalizado." : "Examen de matemáticas de Diego agendado para el lunes. Plan de estudio aún no iniciado hoy."}</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border flex items-start gap-3 ${cfg.listItemBg}`}>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className={`block font-semibold ${cfg.cardTitle}`}>Despensa & Compras</strong>
                    <span>Faltan {shoppingItems.filter(i => !i.checked).length} productos en la despensa. Domi ya los ha organizado y distribuido por lugar de compra listo para ir al súper.</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border flex items-start gap-3 ${cfg.listItemBg}`}>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className={`block font-semibold ${cfg.cardTitle}`}>Seguridad del Hogar</strong>
                    <span>Vigilancia perimetral activa. Todos los puntos de acceso cerrados. Modo de seguridad nocturna operando correctamente.</span>
                  </div>
                </div>
              </div>

              <div className={`p-3 border rounded-xl text-center ${cfg.listBg}`}>
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block mb-1 ${isLight ? "text-amber-600" : "text-amber-400"}`}>Índice de bienestar general</span>
                <span className={`text-xl font-bold font-display ${cfg.titleText}`}>94 / 100</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </AnimatePresence>
  );
}
