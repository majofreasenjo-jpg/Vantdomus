/**
 * Catálogo de avatares ilustrados (set curado, estilo Netflix/Disney).
 *
 * Formato del valor `avatar` guardado en el integrante:
 *   - "emoji:🐻"                  → avatar del set (este catálogo)
 *   - "data:image/...;base64,..." → foto subida por el integrante
 *   - null / ""                   → sin avatar (se usa color + inicial)
 */

export const AVATAR_PRESETS: string[] = [
  "🐻", "🦊", "🐼", "🐯", "🦁", "🐨", "🐶", "🐱",
  "🐰", "🐸", "🦉", "🐧", "🦄", "🐢", "🐥", "🦋",
  "🌟", "🌈", "🌻", "🍀", "⚽", "🎨", "🎸", "🚀",
];

export type AvatarKind = { kind: "photo"; src: string } | { kind: "emoji"; char: string } | { kind: "none" };

export function parseAvatar(avatar?: string | null): AvatarKind {
  const a = (avatar || "").trim();
  if (!a) return { kind: "none" };
  if (a.startsWith("data:")) return { kind: "photo", src: a };
  if (a.startsWith("emoji:")) return { kind: "emoji", char: a.slice(6) };
  return { kind: "none" };
}

export function emojiAvatar(char: string): string {
  return `emoji:${char}`;
}
