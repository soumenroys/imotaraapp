// src/app/admin/_components/scrollToTarget.ts
// 🔑 A link from the To do page must LAND on the thing it names. Walked live
// 24 Oct: every link opened the right page, but the draft, the review screen or
// the tab sat below the tutorial and the flow diagram — off screen — so the
// admin saw the same top of page whatever they clicked.
//
// The target renders after data loads, so this waits (up to 6 s) for it.

export function scrollToTarget(id: string, timeoutMs = 6000): void {
  if (typeof window === "undefined") return;
  const started = Date.now();
  const tick = () => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (Date.now() - started < timeoutMs) window.setTimeout(tick, 150);
  };
  window.setTimeout(tick, 50);
}
