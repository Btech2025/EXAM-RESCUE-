/**
 * Soft synthetic Web Audio sound generator for the Exam Rescue mascot.
 * Only plays if sound is explicitly enabled by the user or toggled on.
 * Zero external audio files required.
 */

const SOUND_KEY = "exam-rescue:mascot-sound";

export function isMascotSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SOUND_KEY) === "true";
  } catch {
    return false;
  }
}

export function setMascotSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent("exam-rescue:sound-changed", { detail: { enabled } }));
  } catch {
    // Ignore storage issues
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  } catch {
    return null;
  }
}

/**
 * Gentle magical entrance chime (C5 -> E5 -> G5 -> C6)
 */
export function playEntranceChime(force = false): void {
  if (!force && !isMascotSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const notes = [523.25, 659.25, 783.99, 1046.5];
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    // Soft chime envelope
    gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.5);
  });
}

/**
 * Celebratory fanfare chime on task completion / topic mastered
 */
export function playCelebrationChime(force = false): void {
  if (!force && !isMascotSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const notes = [587.33, 783.99, 987.77, 1174.66]; // D5 -> G5 -> B5 -> D6
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + idx * 0.07);

    gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.1, now + idx * 0.07 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.07);
    osc.stop(now + idx * 0.07 + 0.55);
  });
}

/**
 * Subtle pop sound on mascot click / surprise peek
 */
export function playPopChime(force = false): void {
  if (!force && !isMascotSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  osc.type = "sine";
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(840, now + 0.06);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.14);
}
