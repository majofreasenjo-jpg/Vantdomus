"use client";

import React, { useEffect, useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

export function KPIDonut({ 
  value, 
  title, 
  valueColor, 
  description,
  accentColor 
}: { 
  value: number, 
  title: string, 
  valueColor: string, 
  description: string,
  accentColor: string
}) {
  // Manejo de hidratación para Recharts en Next.js (evita errores SSR vs Client mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  const safeValue = Math.min(100, Math.max(0, value));
  
  const data = [
    {
      name: "KPI",
      val: safeValue,
      fill: valueColor,
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <div className="cardTitle" style={{ marginBottom: -10, zIndex: 10, position: "relative" }}>
         {title}
      </div>
      
      <div style={{ flex: 1, position: "relative", minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {mounted && (
           <ResponsiveContainer width="100%" height="100%">
             <RadialBarChart 
               cx="50%" 
               cy="50%" 
               innerRadius="75%" 
               outerRadius="100%" 
               barSize={14} 
               data={data} 
               startAngle={210} 
               endAngle={-30}
             >
               <PolarAngleAxis 
                 type="number" 
                 domain={[0, 100]} 
                 angleAxisId={0} 
                 tick={false} 
               />
               <RadialBar 
                 background={{ fill: "rgba(255, 255, 255, 0.05)" }}
                 dataKey="val"
                 cornerRadius={10}
                 animationDuration={800}
                 animationEasing="ease-out"
               />
             </RadialBarChart>
           </ResponsiveContainer>
        )}
        
        {/* Texto porcentual centrado absolutamente sobre el RadialBar */}
        <div style={{ 
          position: "absolute", 
          top: "50%", left: "50%", 
          transform: "translate(-50%, -50%)",
          display: "flex", flexDirection: "column", 
          alignItems: "center", justifyContent: "center",
          pointerEvents: "none", zIndex: 5
        }}>
          <span style={{ 
            fontSize: 32, 
            fontWeight: 800, 
            color: mounted ? valueColor : "transparent", 
            textShadow: `0 0 15px ${valueColor}30`,
            marginTop: 15
          }}>
            {Math.round(safeValue)}<span style={{ fontSize: 18, opacity: 0.7 }}>%</span>
          </span>
        </div>
      </div>
      
      <div className="small" style={{ 
         marginTop: "auto", 
         paddingTop: 12, 
         borderTop: `1px solid rgba(255,255,255,0.05)`, 
         color: "var(--muted)",
         lineHeight: 1.4
      }}>
        {description}
      </div>
    </div>
  );
}
