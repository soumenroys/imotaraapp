// src/app/admin/_components/scrollToTarget.ts
// 🔑 A link from the To do page must LAND on the thing it names. Walked live
// 24 Oct: every link opened the right page, but the draft, the review screen or
// the tab sat below the tutorial and the flow diagram — off screen — so the
// admin saw the same top of page whatever they clicked.
//
// ⚠️ Finding the element is not enough: the status strip and the diagram load
// AFTER it and push it down (measured live: scrolled, then the tabs bar sat
// 280 px below the screen). So this waits until the target has stopped moving
// — the same position on four checks in a row — and only then scrolls.

export function scrollToTarget(id: string, timeoutMs = 8000): void {
  if (typeof window === "undefined") return;
  const started = Date.now();
  let last = NaN;
  let still = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      still = top === last ? still + 1 : 0;
      last = top;
      if (still >= 3) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    }
    if (Date.now() - started < timeoutMs) window.setTimeout(tick, 150);
    else el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  window.setTimeout(tick, 50);
}
