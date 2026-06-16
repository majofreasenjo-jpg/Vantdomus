"use client";

import React, { useEffect, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function RiskRadar({ state, tax }: { state: any, tax: any }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = [
    {
      subject: tax.kpi.osi,
      A: state.global_osi || 0,
      fullMark: 100,
    },
    {
      subject: tax.kpi.health,
      A: state.global_health || 0,
      fullMark: 100,
    },
    {
      subject: tax.kpi.finance,
      A: state.global_finance || 0,
      fullMark: 100,
    },
    {
      subject: tax.kpi.tasks,
      A: state.global_task || 0,
      fullMark: 100,
    }
  ];

  if (!mounted) {
      return <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando Motor Analítico...</div>;
  }

  // Estilización del Tooltip para que coincida con el tema oscuro/neón corporativo
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: "rgba(18, 26, 38, 0.95)", border: "1px solid var(--primary)", padding: "10px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "12px" }}>{payload[0].payload.subject}</p>
          <p style={{ color: "var(--primary)", margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold" }}>
            {Number(payload[0].value).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: "100%", height: 350, position: "relative" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted)", fontSize: 13 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)" }} tickCount={6} />
          <Tooltip content={<CustomTooltip />} />
          <Radar 
            name="Contrato Actual" 
            dataKey="A" 
            stroke="var(--primary)" 
            strokeWidth={2}
            fill="var(--primary)" 
            fillOpacity={0.25} 
            animationDuration={800}
            animationEasing="ease-out"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
