/**
 * CardSkeleton — placeholder con forma de tarjeta para estados de carga.
 * Patrón Linear: el esqueleto imita la forma de la data real.
 */
import React from "react";

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="skel skelTitle" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skel skelLine" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function PageSkeleton({ title = "Cargando…", cards = 3 }: { title?: string; cards?: number }) {
  return (
    <div className="container">
      <div className="skel skelTitle" style={{ width: 220, height: 28, marginBottom: 18 }} />
      <div className="grid" style={{ gap: 14 }}>
        {Array.from({ length: cards }).map((_, i) => <CardSkeleton key={i} lines={3} />)}
      </div>
      <span className="small" style={{ position: "absolute", left: -9999 }}>{title}</span>
    </div>
  );
}

export default PageSkeleton;
