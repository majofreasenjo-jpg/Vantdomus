"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "./domiMotion";
import { 
  Mic, 
  Paperclip, 
  Send, 
  X, 
  Sparkles, 
  User, 
  HelpCircle,
  FileText,
  Check,
  UploadCloud
} from "lucide-react";
import { ChatMessage } from "./domiTypes";

interface DomiChatProps {
  messages: ChatMessage[];
  isListening: boolean;
  isSending: boolean;
  onSendMessage: (text: string) => void;
  onToggleListening: () => void;
  onAddSystemNotification: (title: string, msg: string, type: string) => void;
  onSimulateAction: (actionType: string, payload?: string) => void;
  onOpenDocPanel?: () => void;
  /** CP1c-FUNC-MIN-3.1a/3.2 — decisión humana sobre una propuesta real del
   *  orquestador; overrides = edición whitelisted antes de confirmar. */
  onDecideProposal?: (messageId: string, proposalId: string, accept: boolean, overrides?: Record<string, unknown>) => void;
  activeTheme?: "dawn" | "day" | "sunset" | "night";
}

export default function DomiChat({
  messages,
  isListening,
  isSending,
  onSendMessage,
  onToggleListening,
  onAddSystemNotification,
  onSimulateAction,
  onOpenDocPanel,
  onDecideProposal,
  activeTheme = "night"
}: DomiChatProps) {
  const [inputText, setInputText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // MIN-3.2 — edición de una propuesta antes de confirmar (solo campos
  // whitelisted por el contrato; el backend revalida todo igual).
  const [editingProp, setEditingProp] = useState<{ propId: string; field: "items" | "title"; text: string } | null>(null);
  const isLight = activeTheme === "dawn" || activeTheme === "day";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    
    onSendMessage(inputText);
    setInputText("");
    setIsOpen(true); // Auto open panel to show response
  };

  const handleSmartReply = (reply: string) => {
    if (isSending) return;
    onSendMessage(reply);
    setIsOpen(true);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // CP1c-MIN-2: arrastrar un archivo abre Domi Documental (Smart Inbox real),
  // ya no la simulación por nombre de archivo.
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onOpenDocPanel?.();
    }
  };

  // Scroll to bottom helper
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending]);

  const suggestions = [
    { text: "Elena ya tomó el medicamento", label: "Confirmar Medicina" },
    { text: "Prepara el estudio de matemáticas de Diego", label: "Preparar Estudio" },
    { text: "Agrega leche y plátanos a la lista", label: "Agregar Compras" },
    { text: "Ayúdame a relajarme por favor", label: "Iniciar Respiración" }
  ];

  return (
    <div className="w-full flex flex-col items-center z-20 relative">

      {/* 1. COLLAPSIBLE CONVERSATION PANEL
           Flota HACIA ARRIBA sobre Domi (absolute bottom-full) en vez de empujar
           el input hacia abajo: así el campo de escritura queda SIEMPRE visible
           (antes el panel de 320px empujaba el input fuera de pantalla). */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[calc(100%-1rem)] max-w-3xl rounded-3xl p-5 flex flex-col h-[320px] shadow-2xl overflow-hidden backdrop-blur-md border z-30 ${
              isLight
                ? "bg-white/95 border-amber-500/20 shadow-slate-300/50"
                : "glass-panel border-amber-500/10 glow-gold"
            }`}
          >
            {/* Top header of chat panel */}
            <div className={`flex items-center justify-between border-b pb-3 mb-3 z-10 ${
              isLight ? "border-slate-100" : "border-slate-800"
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                  isLight ? "bg-amber-100 border-amber-300" : "bg-amber-500/20 border-amber-500/30"
                }`}>
                  <Sparkles className={`w-3.5 h-3.5 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold font-display ${isLight ? "text-slate-900" : "text-slate-100"}`}>Conversación con Domi</h4>
                  <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Asistente Inteligente del Hogar</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded-lg transition-colors ${
                  isLight ? "text-slate-400 hover:text-slate-800 hover:bg-slate-100" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-800 no-scrollbar mb-3">
              {messages.filter(m => m.role !== "system").map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
                >
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold ${
                    msg.role === "user" 
                      ? (isLight ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-500/20 text-blue-300 border border-blue-500/30") 
                      : (isLight ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-amber-500/20 text-amber-300 border border-amber-500/30")
                  }`}>
                    {msg.role === "user" ? <User className="w-4 h-4" /> : "D"}
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? (isLight ? "bg-blue-50/90 border border-blue-100 text-slate-800 rounded-tr-none" : "bg-blue-500/10 border border-blue-500/20 text-slate-100 rounded-tr-none")
                        : (isLight ? "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none" : "bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-none")
                    }`}>
                      <p>{msg.content}</p>
                      {/* MIN-3.1a: honestidad — respuesta del simulador local, no del orquestador real */}
                      {msg.isLocalDemo && (
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                          isLight ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        }`}>
                          DEMO LOCAL · sin conexión al hogar
                        </span>
                      )}
                      <span className={`block text-[10px] mt-1 font-mono text-right ${
                        isLight ? "text-slate-400" : "text-slate-500"
                      }`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* MIN-3.1a/3.2: PROPUESTAS REALES del orquestador — Domi propone,
                        tú revisas (y puedes editar), tú decides. */}
                    {(msg.proposals || []).map((prop) => {
                      const isEditing = editingProp?.propId === prop.id;
                      const canEditItems = (prop.editable_fields || []).includes("items");
                      const canEditTitle = !canEditItems && (prop.editable_fields || []).includes("title");
                      const startEdit = () => {
                        if (canEditItems) {
                          setEditingProp({ propId: prop.id, field: "items", text: (prop.proposed_payload?.items || []).join(", ") });
                        } else if (canEditTitle) {
                          setEditingProp({ propId: prop.id, field: "title", text: String(prop.proposed_payload?.title || prop.title || "") });
                        }
                      };
                      const confirmWithEdits = () => {
                        let overrides: Record<string, unknown> | undefined;
                        if (isEditing && editingProp) {
                          overrides = editingProp.field === "items"
                            ? { items: editingProp.text.split(",").map(s => s.trim()).filter(Boolean) }
                            : { title: editingProp.text.trim() };
                        }
                        setEditingProp(null);
                        onDecideProposal?.(msg.id, prop.id, true, overrides);
                      };
                      const expiraTxt = prop.expires_at
                        ? new Date(prop.expires_at).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : null;
                      const actionable = prop.status === "pending" || prop.status === "failed";
                      return (
                      <div key={prop.id} className={`p-3 rounded-2xl border ${
                        isLight ? "bg-white border-amber-300/60 shadow-sm" : "bg-slate-900/90 border-amber-500/30"
                      }`}>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
                          <span className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-slate-100"}`}>{prop.title}</span>
                          {prop.sensitive && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              isLight ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                            }`}>requiere tu OK</span>
                          )}
                        </div>
                        <p className={`text-[13px] mb-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          {prop.summary} <strong>Revisa antes de confirmar.</strong>
                        </p>
                        {actionable && expiraTxt && (
                          <p className={`text-[12px] mb-2 ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                            ⏳ Disponible hasta {expiraTxt} — después expira y Domi la propone de nuevo si quieres.
                          </p>
                        )}

                        {/* MIN-3.2: edición whitelisted antes de confirmar */}
                        {isEditing && (
                          <div className="mb-2">
                            <label className={`block text-[12px] font-bold mb-1 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                              {editingProp!.field === "items" ? "Productos (separados por coma):" : "Título:"}
                            </label>
                            <input
                              value={editingProp!.text}
                              onChange={(e) => setEditingProp(prev => prev ? { ...prev, text: e.target.value } : prev)}
                              className={`w-full px-3 py-2 rounded-xl border text-sm outline-none select-text ${
                                isLight ? "bg-white border-amber-300 text-slate-800" : "bg-slate-950 border-amber-500/40 text-slate-100"
                              }`}
                              aria-label="Editar propuesta"
                            />
                          </div>
                        )}

                        {actionable ? (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={confirmWithEdits}
                              disabled={isSending || (isEditing && !editingProp?.text.trim())}
                              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                                isLight
                                  ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600"
                                  : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                              }`}
                            >
                              <Check className="w-3 h-3" /> {prop.status === "failed" ? "Reintentar" : isEditing ? "Confirmar cambios" : "Confirmar"}
                            </button>
                            {(canEditItems || canEditTitle) && !isEditing && prop.status === "pending" && (
                              <button
                                onClick={startEdit}
                                disabled={isSending}
                                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                                  isLight
                                    ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                    : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                                }`}
                              >
                                ✏️ Editar
                              </button>
                            )}
                            {isEditing && (
                              <button
                                onClick={() => setEditingProp(null)}
                                disabled={isSending}
                                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                                  isLight ? "bg-white border-slate-300 text-slate-600 hover:bg-slate-100" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                }`}
                              >
                                Deshacer edición
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingProp(null); onDecideProposal?.(msg.id, prop.id, false); }}
                              disabled={isSending}
                              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                                isLight
                                  ? "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                              }`}
                            >
                              <X className="w-3 h-3" /> Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[13px] font-bold ${
                            prop.status === "executed"
                              ? (isLight ? "text-emerald-600" : "text-emerald-400")
                              : (isLight ? "text-slate-500" : "text-slate-400")
                          }`}>
                            {prop.status === "executed" ? "✅ Confirmado y hecho"
                              : prop.status === "rejected" ? "🚫 Rechazado"
                              : prop.status === "expired" ? "⏰ Expirada — pídesela de nuevo a Domi"
                              : prop.status}
                          </span>
                        )}
                        {prop.status === "failed" && (
                          <p className={`text-[12px] mt-1 font-semibold ${isLight ? "text-rose-600" : "text-rose-300"}`}>
                            ⚠️ La acción falló y NO se ejecutó. Puedes reintentar o rechazar.
                          </p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex gap-3 max-w-[80%]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                    isLight ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  }`}>
                    D
                  </div>
                  <div className={`p-3 rounded-2xl rounded-tl-none flex items-center gap-1 ${
                    isLight ? "bg-slate-50 border border-slate-100" : "bg-slate-900/60 border border-slate-800"
                  }`}>
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Suggested replies */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 z-10">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSmartReply(sug.text)}
                  className={`px-3 py-1 rounded-full text-xs transition-all whitespace-nowrap shrink-0 ${
                    isLight 
                      ? "bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-600 hover:text-amber-800 hover:border-amber-400" 
                      : "bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-500/30"
                  }`}
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. AUDIO EQUALIZER (ESCUDANDO) */}
      <AnimatePresence>
        {isListening && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-1.5 mb-2 text-amber-400 text-xs font-bold font-mono tracking-[0.2em] bg-amber-500/5 px-4 py-1.5 rounded-full border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          >
            <div className="flex items-end gap-0.5 h-4 w-12 justify-center">
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
            </div>
            <span>ESCUCHANDO</span>
            <div className="flex items-end gap-0.5 h-4 w-12 justify-center">
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
              <span className="eq-bar w-0.5 bg-amber-400 rounded-full" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. PRIMARY VOID INPUT BAR (PILL CONTAINER) */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full max-w-3xl rounded-full p-1.5 md:p-2 border relative transition-all duration-300 flex items-center justify-between ${
          isDragging 
            ? "border-amber-500 glow-gold bg-amber-500/5 scale-[1.02]" 
            : isLight 
              ? "bg-white/85 border-white/95 shadow-md shadow-slate-200/40 focus-within:border-amber-400/50" 
              : "glass-panel border-slate-800 focus-within:border-slate-700 focus-within:glow-blue"
        }`}
      >
        {/* Drag and Drop Hover overlay hint */}
        {isDragging && (
          <div className="absolute inset-0 bg-slate-950/80 rounded-full flex items-center justify-center gap-2 pointer-events-none text-sm text-amber-300 font-medium animate-pulse z-30">
            <UploadCloud className="w-4 h-4 animate-bounce" />
            <span>Suelta archivos de compras, tareas o cuidado aquí...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 md:gap-3 px-1 md:px-2">
          {/* Microphone trigger (Voice simulation) */}
          <button
            type="button"
            onClick={onToggleListening}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 shrink-0 cursor-pointer ${
              isListening 
                ? "bg-red-500/20 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse" 
                : "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-400 hover:glow-gold"
            }`}
          >
            <Mic className="w-4 h-4 font-bold" />
          </button>

          {/* Clip = abre Domi Documental (Smart Inbox real): PDF/texto/URL. */}
          <button
            type="button"
            onClick={() => onOpenDocPanel?.()}
            title="Subir un documento para que Domi lo lea"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              isLight ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>

          {/* Text Input area */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="Habla con Domi o cuéntale qué necesitas..."
            className={`flex-1 bg-transparent border-none text-sm md:text-base outline-none select-text pr-2 ${
              isLight ? "text-slate-800 placeholder-slate-500" : "text-slate-100 placeholder-slate-400"
            }`}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 shrink-0 cursor-pointer ${
              inputText.trim() && !isSending
                ? "bg-gradient-to-r from-blue-500 to-teal-500 text-slate-950 border-blue-400 hover:glow-blue"
                : isLight 
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>

    </div>
  );
}
