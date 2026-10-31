/**
 * R91: same-page signal to reload authenticated, server-owned household memory.
 * No memory content or tokens are carried in events. Event is not a persistence
 * mechanism; every subscriber re-fetches from its authorized API endpoint.
 */
const MEMORY_CHANGED = "domi:household-memory-updated";

export function notifyDomiMemoryChanged(householdId: string): void {
  if (typeof window === "undefined" || !householdId) return;
  window.dispatchEvent(new CustomEvent(MEMORY_CHANGED, {
    detail: {householdId},
  }));
}

export function onDomiMemoryChanged(householdId: string, callback: () => void): () => void {
  if (typeof window === "undefined" || !householdId) return () => {};
  const onChanged = (event: Event) => {
    if ((event as CustomEvent<{householdId?: string}>).detail?.householdId === householdId) {
      callback();
    }
  };
  window.addEventListener(MEMORY_CHANGED, onChanged);
  return () => window.removeEventListener(MEMORY_CHANGED, onChanged);
}
