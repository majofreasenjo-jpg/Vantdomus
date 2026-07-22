// OPS-2 M4 — Voz en el navegador.
//  - TTS (Domi habla): Web Speech Synthesis, gratis, con velocidad/volumen y voz
//    más lenta para modo Senior. No guarda audio.
//  - Grabación (para STT): MediaRecorder → Blob, que se envía al backend a
//    transcribir (Whisper). El audio no se guarda en el servidor.

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let _spanishVoice: SpeechSynthesisVoice | null = null;
function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  if (_spanishVoice) return _spanishVoice;
  const voices = window.speechSynthesis.getVoices() || [];
  _spanishVoice =
    voices.find((v) => v.lang?.toLowerCase().startsWith("es-cl")) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("es")) ||
    null;
  return _spanishVoice;
}

/** Lee un texto en voz alta. rate<1 = más lento (Senior). */
export function speak(text: string, opts: { rate?: number; volume?: number } = {}): void {
  if (!speechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel(); // no encimar
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-CL";
  u.rate = Math.max(0.5, Math.min(1.5, opts.rate ?? 1));
  u.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
  const v = pickSpanishVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return speechSupported() && window.speechSynthesis.speaking;
}

export function recordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder !== "undefined"
  );
}

export type Recorder = { stop: () => Promise<{ blob: Blob; mime: string }> };

/** Pide permiso de micrófono y empieza a grabar. Devuelve un stop() que corta. */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferred = ["audio/webm", "audio/ogg", "audio/mp4"];
  const mime = preferred.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const outMime = mime || "audio/webm";
          resolve({ blob: new Blob(chunks, { type: outMime }), mime: outMime });
        };
        rec.stop();
      }),
  };
}

export function mimeToFilename(mime: string): string {
  if (mime.includes("ogg")) return "nota.ogg";
  if (mime.includes("mp4")) return "nota.mp4";
  return "nota.webm";
}
