"use client";

/**
 * NavLink — enlace de navegación que resalta el item activo.
 *
 * El navbar vive en un Server Component (layout.tsx) que no conoce la ruta
 * actual. Este wrapper cliente usa usePathname() para marcar como "activo" el
 * link cuyo primer segmento de ruta coincide con el de la URL actual.
 */

import { usePathname } from "next/navigation";

function firstSegment(path: string): string {
  // "/avisos/123" -> "avisos" ; "/guia" -> "guia" ; "/" -> ""
  const clean = path.split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts[0] || "";
}

export default function NavLink({
  href,
  children,
  style,
}: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const pathname = usePathname() || "/";
  const active = href !== "/" && firstSegment(href) === firstSegment(pathname);
  return (
    <a href={href} className={active ? "navActive" : undefined} aria-current={active ? "page" : undefined} style={style}>
      {children}
    </a>
  );
}
