"use client";

// src/app/dev/modal-preview/page.tsx
// A QA harness for the dialogs (UX-08/09).
//
// It exists because none of these can be opened in a local environment: they
// need a signed-in account, a live Connect session, or sync conflicts to have
// occurred. Without a harness the only way to "verify" a migration would be to
// read the diff and hope, on dialogs that handle payments, crisis resources
// and sync conflict resolution.
//
// /dev/* is removed from production builds by scripts/devRoutes.mjs, so this
// ships to nobody.

import { useState } from "react";
import UnsentLetterModal from "@/components/imotara/UnsentLetterModal";
import ConflictReviewModal from "@/components/imotara/ConflictReviewModal";
import TranslationToggleModal from "@/components/connect/TranslationToggleModal";
import EmergencyModal from "@/components/connect/EmergencyModal";

type Which = "unsentLetter" | "conflicts" | "translation" | "emergency" | null;

export default function ModalPreviewPage() {
  const [open, setOpen] = useState<Which>(null);
  const close = () => setOpen(null);

  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1 className="text-lg font-semibold text-zinc-100">Modal preview (dev only)</h1>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Opens each dialog with stub props so its accessibility and layout can be
        checked without the account, session or sync state it normally needs.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {([
          ["unsentLetter", "Unsent letter"],
          ["conflicts", "Sync conflicts"],
          ["translation", "Translation toggle"],
          ["emergency", "Crisis helplines"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            id={`open-${id}`}
            onClick={() => setOpen(id)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
          >
            {label}
          </button>
        ))}
      </div>

      {open === "unsentLetter" && (
        <UnsentLetterModal visible onStart={close} onCancel={close} />
      )}
      {open === "conflicts" && <ConflictReviewModal open onClose={close} />}
      {open === "translation" && (
        <TranslationToggleModal
          sessionId="dev-preview"
          targetEnabled
          baseRate={10}
          currentRate={10}
          currencyCode="INR"
          isPayer
          onSuccess={close}
          onClose={close}
        />
      )}
      {open === "emergency" && <EmergencyModal countryCode="IN" onClose={close} />}
    </main>
  );
}
