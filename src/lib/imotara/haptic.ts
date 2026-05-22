// src/lib/imotara/haptic.ts
// Micro-haptic feedback utility — no-ops gracefully on desktop / unsupported browsers.
// Respects the user's "imotara.haptic.enabled.v1" localStorage preference (default: enabled).

export const HAPTIC_KEY = "imotara.haptic.enabled.v1";

function isHapticEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  const v = localStorage.getItem(HAPTIC_KEY);
  return v !== "0"; // default on; only off when explicitly set to "0"
}

/** Fire a short vibration pattern if the device supports it and haptics are enabled. */
export function haptic(pattern: number | number[] = 10): void {
  if (!isHapticEnabled()) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore — some browsers throw on vibrate()
    }
  }
}

/** Tiny tap — for bookmarks, reactions, button presses. */
export const hapticTap = () => haptic(10);

/** Double soft pulse — for breathing phase transitions. */
export const hapticBreath = () => haptic([5, 60, 5]);

/** Single medium pulse — for emotion detection. */
export const hapticEmotion = () => haptic(18);

/** Success pattern — for saves, confirmations. */
export const hapticSuccess = () => haptic([8, 40, 8]);
