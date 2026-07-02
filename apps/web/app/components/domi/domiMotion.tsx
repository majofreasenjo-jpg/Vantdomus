"use client";

/**
 * domiMotion — shim local de `motion/react` (CP1b Google Visual Port).
 *
 * El prototipo de AI Studio usa `motion` (framer). El repo NO lo instala
 * (regla del port): este shim mantiene el JSX del prototipo IDÉNTICO
 * (<motion.div animate={...}>) y ejecuta las animaciones con la
 * Web Animations API nativa del navegador (element.animate), sin dependencias.
 *
 * Cubre los patrones usados por el prototipo: initial/animate/exit/transition
 * con valores simples o arrays de keyframes (opacity, scale, x, y, rotate,
 * strokeDashoffset, pathLength y props CSS directas). Limitaciones aceptadas y
 * documentadas: sin animaciones de salida (AnimatePresence es passthrough) y
 * sin transitions por-propiedad anidadas (se usa la global).
 */
import React, { useEffect, useRef, forwardRef } from "react";

type Dict = Record<string, any>;

const MOTION_ONLY_PROPS = new Set([
  "initial", "animate", "exit", "transition", "variants",
  "whileHover", "whileTap", "whileInView", "viewport",
  "layout", "layoutId", "drag", "dragConstraints", "dragElastic",
  "onAnimationComplete", "onAnimationStart",
]);

const TRANSFORM_KEYS = new Set(["x", "y", "scale", "scaleX", "scaleY", "rotate"]);

function buildTransform(v: Dict, frameIndex: number, frames: number): string {
  const px = (n: any) => (typeof n === "number" ? `${n}px` : n);
  const deg = (n: any) => (typeof n === "number" ? `${n}deg` : n);
  const pick = (val: any) => (Array.isArray(val) ? val[Math.min(frameIndex, val.length - 1)] : val);
  const parts: string[] = [];
  if (v.x !== undefined) parts.push(`translateX(${px(pick(v.x))})`);
  if (v.y !== undefined) parts.push(`translateY(${px(pick(v.y))})`);
  if (v.rotate !== undefined) parts.push(`rotate(${deg(pick(v.rotate))})`);
  if (v.scale !== undefined) parts.push(`scale(${pick(v.scale)})`);
  if (v.scaleX !== undefined) parts.push(`scaleX(${pick(v.scaleX)})`);
  if (v.scaleY !== undefined) parts.push(`scaleY(${pick(v.scaleY)})`);
  return parts.join(" ");
}

function mapEase(ease: any): string {
  if (Array.isArray(ease) && ease.length === 4) return `cubic-bezier(${ease.join(",")})`;
  switch (ease) {
    case "linear": return "linear";
    case "easeIn": return "ease-in";
    case "easeOut": return "ease-out";
    case "easeInOut": return "ease-in-out";
    default: return "ease";
  }
}

/** Convierte un objeto estilo-motion en un keyframe WAAPI. */
function toFrame(v: Dict, frameIndex: number, totalFrames: number): Dict {
  const frame: Dict = {};
  const hasTransform = Object.keys(v).some((k) => TRANSFORM_KEYS.has(k));
  if (hasTransform) frame.transform = buildTransform(v, frameIndex, totalFrames) || "none";
  for (const [k, raw] of Object.entries(v)) {
    if (TRANSFORM_KEYS.has(k)) continue;
    const val = Array.isArray(raw) ? raw[Math.min(frameIndex, raw.length - 1)] : raw;
    if (k === "pathLength") {
      // motion anima el trazo SVG vía pathLength: emulamos con dash (requiere
      // pathLength=1 en el elemento; lo fija el componente al montar).
      frame.strokeDasharray = "1";
      frame.strokeDashoffset = String(1 - Number(val));
      continue;
    }
    frame[k] = typeof val === "number" && k !== "opacity" && k !== "zIndex" && !k.startsWith("stroke") && k !== "cx" && k !== "cy" && k !== "r"
      ? `${val}px`
      : String(val);
  }
  return frame;
}

function runAnimation(el: Element, initial: any, animate: any, transition: any) {
  if (!el || typeof (el as any).animate !== "function" || !animate || typeof animate !== "object") return;
  const keys = Object.keys(animate);
  if (keys.length === 0) return;
  // nº de frames = mayor largo de array en animate (o 2 si initial→animate)
  const arrayLen = Math.max(1, ...keys.map((k) => (Array.isArray(animate[k]) ? animate[k].length : 1)));
  const frames: Dict[] = [];
  if (arrayLen > 1) {
    for (let i = 0; i < arrayLen; i++) frames.push(toFrame(animate, i, arrayLen));
  } else {
    if (initial && typeof initial === "object") frames.push(toFrame(initial, 0, 1));
    frames.push(toFrame(animate, 0, 1));
  }
  if (frames.length < 2) frames.unshift(frames[0]);
  const t = transition || {};
  const repeat = t.repeat === Infinity ? Infinity : t.repeat ? Number(t.repeat) + 1 : 1;
  try {
    if ("pathLength" in animate) el.setAttribute("pathLength", "1");
    return el.animate(frames as Keyframe[], {
      duration: (t.duration ?? 0.3) * 1000,
      delay: (t.delay ?? 0) * 1000,
      iterations: repeat,
      direction: t.repeatType === "reverse" || t.repeatType === "mirror" ? "alternate" : "normal",
      easing: mapEase(t.ease),
      fill: "both",
    });
  } catch {
    // fallback silencioso: dejar el estado final sin animar
    return undefined;
  }
}

function initialStyle(initial: any): Dict {
  if (!initial || typeof initial !== "object") return {};
  const f = toFrame(initial, 0, 1);
  const style: Dict = {};
  for (const [k, v] of Object.entries(f)) style[k] = v;
  return style;
}

const cache = new Map<string, any>();

function createMotionComponent(tag: string) {
  if (cache.has(tag)) return cache.get(tag);
  const Comp = forwardRef<Element, Dict>(function MotionShim(props, outerRef) {
    const { initial, animate, exit, transition, style, ...rest } = props;
    const innerRef = useRef<Element | null>(null);
    const animRef = useRef<Animation | undefined>(undefined);

    useEffect(() => {
      animRef.current?.cancel();
      if (innerRef.current) {
        animRef.current = runAnimation(innerRef.current, initial, animate, transition);
      }
      return () => animRef.current?.cancel();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(animate), JSON.stringify(transition)]);

    const clean: Dict = {};
    for (const [k, v] of Object.entries(rest)) {
      if (MOTION_ONLY_PROPS.has(k)) continue;
      // Eventos de motion → eventos nativos (conserva el comportamiento hover/tap
      // del prototipo sin warnings de React por props desconocidas).
      if (k === "onHoverStart") { clean.onMouseEnter = v; continue; }
      if (k === "onHoverEnd") { clean.onMouseLeave = v; continue; }
      if (k === "onTap") { clean.onClick = v; continue; }
      clean[k] = v;
    }

    return React.createElement(tag, {
      ...clean,
      style: { ...initialStyle(initial), ...style },
      ref: (node: Element | null) => {
        innerRef.current = node;
        if (typeof outerRef === "function") outerRef(node);
        else if (outerRef) (outerRef as any).current = node;
      },
    });
  });
  cache.set(tag, Comp);
  return Comp;
}

/** Proxy: motion.div / motion.g / motion.path / … como en framer-motion. */
export const motion: any = new Proxy(
  {},
  { get: (_t, tag: string) => createMotionComponent(tag) }
);

/** Passthrough: las animaciones de salida no se emulan (limitación aceptada). */
export function AnimatePresence({ children }: { children?: React.ReactNode; mode?: string; initial?: boolean }) {
  return <>{children}</>;
}
