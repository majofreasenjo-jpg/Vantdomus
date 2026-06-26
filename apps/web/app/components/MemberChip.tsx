/**
 * MemberChip — identidad visual de cada integrante (color + inicial).
 *
 * Patrón Cozi/Copilot: cada persona lleva un color estable que la acompaña en
 * toda la app (actividades, compras, avisos, salud), para que la familia "lea"
 * de un vistazo de quién es cada cosa. Server o Client Component (sin hooks).
 */

import React from "react";
import { memberColor, initials } from "../../lib/memberColor";
import { parseAvatar } from "../../lib/avatars";

export default function MemberChip({
  name,
  personId,
  avatar,
  size = 24,
  showName = true,
  bold = false,
}: {
  name: string;
  personId?: string;
  avatar?: string | null;
  size?: number;
  showName?: boolean;
  bold?: boolean;
}) {
  const c = memberColor(personId || name);
  const av = parseAvatar(avatar);
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    boxShadow: "0 1px 3px rgba(0,0,0,.18)",
    overflow: "hidden",
  };
  let badge: React.ReactNode;
  if (av.kind === "photo") {
    // eslint-disable-next-line @next/next/no-img-element
    badge = <img src={av.src} alt="" style={{ ...base, objectFit: "cover" }} aria-hidden="true" />;
  } else if (av.kind === "emoji") {
    badge = (
      <span aria-hidden="true" style={{ ...base, background: c.soft, fontSize: Math.round(size * 0.58) }}>
        {av.char}
      </span>
    );
  } else {
    badge = (
      <span aria-hidden="true" style={{ ...base, background: c.bg, color: c.fg, fontSize: Math.round(size * 0.42), fontWeight: 800 }}>
        {initials(name)}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {badge}
      {showName ? (
        <span style={{ fontWeight: bold ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      ) : null}
    </span>
  );
}
