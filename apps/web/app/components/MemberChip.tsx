/**
 * MemberChip — identidad visual de cada integrante (color + inicial).
 *
 * Patrón Cozi/Copilot: cada persona lleva un color estable que la acompaña en
 * toda la app (actividades, compras, avisos, salud), para que la familia "lea"
 * de un vistazo de quién es cada cosa. Server o Client Component (sin hooks).
 */

import React from "react";
import { memberColor, initials } from "../../lib/memberColor";

export default function MemberChip({
  name,
  personId,
  size = 24,
  showName = true,
  bold = false,
}: {
  name: string;
  personId?: string;
  size?: number;
  showName?: boolean;
  bold?: boolean;
}) {
  const c = memberColor(personId || name);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: c.bg,
          color: c.fg,
          fontSize: Math.round(size * 0.42),
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          boxShadow: "0 1px 3px rgba(0,0,0,.18)",
        }}
      >
        {initials(name)}
      </span>
      {showName ? (
        <span style={{ fontWeight: bold ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      ) : null}
    </span>
  );
}
