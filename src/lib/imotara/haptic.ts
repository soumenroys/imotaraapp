// src/lib/imotara/haptic.ts
// Micro-haptic feedback utility — no-ops gracefully on desktop / unsupported browsers.

/** Fire a short vibration pattern if the device supports it. */
export function haptic(pattern: number | number[] = 10): void {
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
