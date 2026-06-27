"use client";

/**
 * DomiCalm — sonido tranquilo generado LOCALMENTE con Web Audio API.
 * Sin archivos ni servicios externos: un pad suave (dos osciladores + filtro)
 * que se enciende/apaga. Apoyo de calma, NO clínico.
 */
import { useEffect, useRef, useState } from "react";

export default function DomiCalm({ title = "Sonido tranquilo" }: { title?: string }) {
  const [on, setOn] = useState(false);
  const ref = useRef<{ ctx: AudioContext; nodes: any[] } | null>(null);

  function stop() {
    const r = ref.current;
    if (r) {
      try { r.nodes.forEach((n) => n.stop && n.stop()); r.ctx.close(); } catch {}
      ref.current = null;
    }
    setOn(false);
  }

  function start() {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
      master.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 2.5);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 700; filter.connect(master);
      const freqs = [220, 277.18, 329.63]; // La menor suave
      const oscs = freqs.map((f, i) => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0.5 - i * 0.12;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08 + i * 0.03;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.04;
        lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
        o.connect(g); g.connect(filter); o.start();
        return [o, lfo];
      }).flat();
      ref.current = { ctx, nodes: oscs };
      setOn(true);
    } catch {
      setOn(false);
    }
  }

  useEffect(() => () => stop(), []);

  return (
    <div>
      <div className="dcardTitle">{title}</div>
      <div className="dcardMuted">Generado por VantDomus, sin internet. Apoyo de calma, no clínico.</div>
      <div className="dcardActions">
        <button className="btn" onClick={on ? stop : start} style={{ background: on ? "#7FB49C" : undefined, color: on ? "#fff" : undefined }}>
          {on ? "■ Detener" : "▶ Poner sonido tranquilo"}
        </button>
      </div>
    </div>
  );
}
