"use client";

import React, { useState } from "react";
import { motion } from "./domiMotion";
import { TrendingUp, RefreshCw, Sparkles } from "lucide-react";

interface EquilibrioChartProps {
  onOpenSummary: () => void;
}

export default function EquilibrioChart({ onOpenSummary }: EquilibrioChartProps) {
  const [metricFilter, setMetricFilter] = useState<"general" | "energia" | "sueno">("general");

  // Custom coordinate points for beautiful smooth spline paths
  const chartPaths = {
    general: "M 20 80 Q 60 20, 100 50 T 180 30 T 260 70 T 340 40",
    energia: "M 20 50 Q 60 75, 100 30 T 180 60 T 260 20 T 340 55",
    sueno: "M 20 90 Q 60 40, 100 65 T 180 20 T 260 85 T 340 30"
  };

  const getChartLabel = () => {
    switch (metricFilter) {
      case "energia": return "Nivel de energía: Estable (84%)";
      case "sueno": return "Calidad de descanso: Óptimo (92%)";
      default: return "Todo fluye en calma.";
    }
  };

  return (
    <div id="equilibrio-chart" className="glass-panel p-5 rounded-3xl glow-blue flex flex-col h-full relative overflow-hidden group">
      {/* Absolute faint background glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-center justify-between mb-4 z-10">
        <div>
          <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Métrica de Hoy</span>
          <h3 className="text-lg font-semibold text-slate-100 font-display">Tu hogar, en equilibrio</h3>
        </div>
        <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
          <button 
            onClick={() => setMetricFilter("general")}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${metricFilter === "general" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"}`}
          >
            Gral
          </button>
          <button 
            onClick={() => setMetricFilter("energia")}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${metricFilter === "energia" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"}`}
          >
            Energía
          </button>
          <button 
            onClick={() => setMetricFilter("sueno")}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${metricFilter === "sueno" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"}`}
          >
            Sueño
          </button>
        </div>
      </div>

      {/* SVG Canvas Area for Chart */}
      <div className="flex-1 min-h-[100px] flex items-center justify-center relative my-2">
        <svg viewBox="0 0 360 110" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines helper */}
          <line x1="0" y1="20" x2="360" y2="20" stroke="rgba(255,255,255,0.02)" strokeDasharray="4 4" />
          <line x1="0" y1="55" x2="360" y2="55" stroke="rgba(255,255,255,0.02)" strokeDasharray="4 4" />
          <line x1="0" y1="90" x2="360" y2="90" stroke="rgba(255,255,255,0.02)" strokeDasharray="4 4" />

          {/* Dynamic spline path with Framer Motion */}
          <motion.path
            d={chartPaths[metricFilter]}
            fill="none"
            stroke="url(#chartGlow)"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />

          {/* Glowing background shadow under the spline */}
          <motion.path
            d={`${chartPaths[metricFilter]} L 360 110 L 0 110 Z`}
            fill="url(#areaGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          />

          {/* Interactive animated dots representing home nodes */}
          <motion.circle cx="100" cy={metricFilter === "general" ? 50 : metricFilter === "energia" ? 30 : 65} r="5" fill="#3b82f6" className="animate-pulse" />
          <motion.circle cx="260" cy={metricFilter === "general" ? 70 : metricFilter === "energia" ? 20 : 85} r="5" fill="#f59e0b" />
          <motion.circle cx="340" cy={metricFilter === "general" ? 40 : metricFilter === "energia" ? 55 : 30} r="5" fill="#10b981" />
        </svg>

        {/* Floating details banner */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-2 text-[10px] text-slate-500 font-mono">
          <span>08:00</span>
          <span>15:00</span>
          <span>22:00</span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 z-10">
        <p className="text-sm text-slate-300 font-sans flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          <span>{getChartLabel()}</span>
        </p>

        <button 
          onClick={onOpenSummary}
          className="mt-2 w-full py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs font-medium text-blue-400 border border-blue-500/20 hover:border-blue-500/40 transition-all flex items-center justify-center gap-2 group-hover:glow-blue"
        >
          <span>Ver resumen del día</span>
          <TrendingUp className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
