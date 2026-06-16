"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ 
  label, 
  loadingLabel,
  bg, 
  color 
}: { 
  label: string, 
  loadingLabel: string,
  bg: string, 
  color: string 
}) {
  const { pending } = useFormStatus();

  return (
    <button 
      className="btn btnPrimary" 
      type="submit" 
      disabled={pending}
      style={{ 
        background: bg, 
        color: color, 
        borderColor: bg, 
        opacity: pending ? 0.7 : 1, 
        cursor: pending ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8
      }}
    >
      {pending ? (
        <>
          <svg className="spinner" viewBox="0 0 50 50" style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }}>
            <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" stroke="currentColor" strokeDasharray="90,150" strokeLinecap="round" />
          </svg>
          {loadingLabel}
        </>
      ) : label}
    </button>
  );
}
