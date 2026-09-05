"use client";

// src/components/ui/Modal.tsx
// One accessible dialog, so twelve overlays stop each inventing their own
// (UX-08).
//
// Of the twelve `fixed inset-0` overlays in the app, exactly one declared
// role="dialog" and none trapped focus. Tabbing out of an open modal landed
// in the fully interactive page behind it — so a keyboard user could be
// "inside" the crisis-resources dialog while actually operating the page
// underneath, with nothing to tell them. Screen readers had the same problem
// for the same reason: nothing said the rest of the page was unavailable.
//
// Everything here is one of the four things a dialog owes its user: say what
// you are, take focus, keep it, and give it back.

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "textarea:not([disabled])",
  "input:not([disabled]):not([type=hidden])", "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Names the dialog for a screen reader. Use one or the other. */
  label?: string;
  labelledBy?: string;
  /** Payment and other in-flight states turn these off, so a stray Escape or
   *  mis-click cannot abandon something half-done. */
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  /**
   * Layout for the backdrop. Replaces the default rather than adding to it:
   * Tailwind resolves duplicate utilities by stylesheet order, not by their
   * order in the string, so shipping `items-center` and letting callers append
   * `items-start` produces a layout that is correct only by luck.
   */
  backdropClassName?: string;
};

export default function Modal({
  open, onClose, children, label, labelledBy,
  closeOnEscape = true, closeOnBackdrop = true,
  className = "", backdropClassName = "flex items-center justify-center p-4",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  // Remember who had focus, so it can be handed back on close. Without this a
  // keyboard user is dropped at the top of the document every time a dialog
  // closes, losing their place.
  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = returnFocusTo.current;
      if (el && document.contains(el)) {
        try { el.focus({ preventScroll: true }); } catch { /* element may be gone */ }
      }
    };
  }, [open]);

  // Move focus in. Prefer whatever the dialog marks as its first stop,
  // otherwise the panel itself — never leave focus outside an open dialog.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>("[data-autofocus]")
        ?? panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Hold the page still, and make it unreachable to assistive tech and to Tab.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const siblings = Array.from(document.body.children)
      .filter((el) => !el.hasAttribute("data-modal-root")) as HTMLElement[];
    const previous = siblings.map((el) => ({
      el,
      inert: el.hasAttribute("inert"),
      hidden: el.getAttribute("aria-hidden"),
    }));
    for (const el of siblings) {
      el.setAttribute("inert", "");
      // aria-hidden as well, because inert is newer than some of the browsers
      // people actually use, and a screen reader reading the page behind an
      // open dialog is the failure this exists to prevent.
      el.setAttribute("aria-hidden", "true");
    }

    return () => {
      document.body.style.overflow = overflow;
      for (const p of previous) {
        if (!p.inert) p.el.removeAttribute("inert");
        if (p.hidden === null) p.el.removeAttribute("aria-hidden");
        else p.el.setAttribute("aria-hidden", p.hidden);
      }
    };
  }, [open]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && closeOnEscape) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) { e.preventDefault(); return; }

    const first = items[0];
    const last = items[items.length - 1];
    // Wrap at the ends. This is the trap: Tab from the last control returns to
    // the first rather than escaping into the page behind.
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [closeOnEscape, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-modal-root=""
      className={`fixed inset-0 z-[100] ${backdropClassName}`}
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label ?? "Dialog" })}
        tabIndex={-1}
        className={`max-h-[90vh] overflow-y-auto outline-none ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
