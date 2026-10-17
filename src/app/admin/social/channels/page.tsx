"use client";

// /admin/social/channels — the channels, the master switch, and the languages.
//
// 🔐 The controls an Imotara admin may not use are disabled here AND refused by
// the route. ⛔ A disabled button is a hint, never a gate: this page only knows
// the actor's role because the API told it, and the API checks again on every
// request.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { ConnectChannel } from "@/app/admin/social/_components/ConnectChannel";

type Account = {
  id: string;
  platform: string;
  display_name: string;
  token_tail: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: string;
  last_verified_at: string | null;
  last_error: string | null;
};

type LanguageRow = {
  code: string;
  name: string;
  reviewed: boolean;
  abuse_list_ready: boolean;
  abuse_list_builtin: boolean;
  contributedTerms: number;
  mayPostUnattended: boolean;
  reason: string | null;
};

export default function Channels() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [languages, setLanguages] = useState<LanguageRow[]>([]);
  const [paused, setPaused] = useState<boolean>(true);
  const [pauseNote, setPauseNote] = useState<string>("");
  const [scripts, setScripts] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  /** null = not yet known. ⛔ Never assumed true. */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [storage, setStorage] = useState<{ ok: boolean; reason?: string }>({ ok: false });
  const [termsFor, setTermsFor] = useState("");
  const [terms, setTerms] = useState("");

  const isOwner = role === "owner";

  const load = useCallback(async () => {
    setError("");
    const [c, l] = await Promise.all([
      fetch("/api/admin/social/channels", { credentials: "same-origin" }),
      fetch("/api/admin/social/languages", { credentials: "same-origin" }),
    ]);
    if (c.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const cj = await c.json();
    const lj = await l.json();
    if (!c.ok) {
      setError(cj.error ?? "Could not load the channels.");
      return;
    }
    setAccounts(cj.accounts ?? []);
    setPaused(Boolean(cj.settings?.posting_paused));
    setPauseNote(cj.settings?.note ?? "");
    setScripts(cj.scriptsAwaitingVerification ?? []);
    setRole(cj.actorRole ?? "");
    setStorage(cj.tokenStorage ?? { ok: false, reason: "The server did not say." });
    setLanguages(lj.languages ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePause() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/social/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postingPaused: !paused }),
      });
      const json = await res.json();
      setMessage(res.ok ? json.note : json.error);
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function contribute(code: string) {
    const list = terms
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/social/languages", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: code, terms: list }),
      });
      const json = await res.json();
      setMessage(res.ok ? `${json.note} ${json.reminder}` : json.error);
      if (res.ok) {
        setTerms("");
        setTermsFor("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <a href="/admin/social" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Social posting
          </a>
          <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Connected once, with a token the platform issues and you can revoke. Your password is never
            asked for, never stored, and never typed into this page.
          </p>
        </header>

        {authed === false && <SignedOut />}

        {error && (
          <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</div>
        )}
        {message && (
          <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">
            {message}
          </div>
        )}

        {authed === null && (
          <p className="text-sm text-zinc-500">Checking the admin session…</p>
        )}

        {/* ⛔ `=== true`, not `!== false`. While the session check is in
            flight `authed` is null, and the earlier version rendered the whole
            body in that moment — master switch reading "Everything is held",
            counters reading 0 — none of it fetched. Brief on a fast connection,
            not brief on a slow one, and a reassuring lie either way. */}
        {authed === true && (
          <>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 mb-8">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">
              The master switch {!isOwner && <span className="text-xs font-normal text-zinc-500">· owner tier</span>}
            </h2>
            <p className="max-w-xl text-xs text-zinc-400">
              {paused
                ? "Everything is held. Posts are still written and queued; nothing publishes."
                : "Posting is live. Schedules with auto-publish on will go out unread."}
              {pauseNote && <span className="block text-zinc-500">{pauseNote}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void togglePause()}
            disabled={busy || !isOwner}
            title={isOwner ? undefined : "The owner tier only"}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-40 ${
              paused ? "bg-indigo-600 hover:bg-indigo-500" : "border border-amber-800 text-amber-300 hover:bg-amber-950/40"
            }`}
          >
            {paused ? "Resume posting" : "Hold everything"}
          </button>
        </section>

        {connecting && isOwner && (
          <div className="mb-8">
            <ConnectChannel
              storageReady={storage}
              onCancel={() => setConnecting(false)}
              onConnected={(note) => {
                setConnecting(false);
                setMessage(note);
                void load();
              }}
            />
          </div>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-300">Connected</h2>
            {isOwner && (
              <button type="button" onClick={() => setConnecting((c) => !c)}
                className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800">
                {connecting ? "Close" : "Connect a channel"}
              </button>
            )}
          </div>
          {accounts.length === 0 ? (
            <div className="space-y-2 rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-400">
              <p>No channel is connected yet.</p>
              <p className="text-xs leading-relaxed text-zinc-500">
                {storage.ok
                  ? "Tokens are stored encrypted. ⛔ Connecting one does not mean posting works: there is still no adapter to publish with, so a connected channel holds its queue until there is."
                  : `⛔ Nothing can be stored yet. ${storage.reason ?? ""}`}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
              {accounts.map((a) => (
                <li key={a.id} className="space-y-1 bg-zinc-900/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.display_name}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px]">{a.platform}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        a.status === "ok"
                          ? "border-emerald-800 text-emerald-300"
                          : "border-amber-800 text-amber-300"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-500">
                    token ···{a.token_tail ?? "????"} ·{" "}
                    {a.token_expires_at ? `expires ${new Date(a.token_expires_at).toLocaleDateString()}` : "no expiry"}{" "}
                    · {a.last_verified_at ? `verified ${new Date(a.last_verified_at).toLocaleString()}` : "never verified"}
                  </div>
                  {a.last_error && <div className="text-xs text-rose-300">{a.last_error}</div>}
                  {(a.status === "dead" || a.status === "expiring") && (
                    <div className="text-xs text-amber-300">
                      ▶️ Re-validate: generate a new token on the platform and paste it here. ⛔ Your
                      password is not involved — changing it does not break posting.
                    </div>
                  )}
                  {a.status === "pending" && (
                    <div className="text-xs text-zinc-500">
                      Stored, but not yet shown to work. ⚠️ Nothing has asked the platform whether it
                      is good — there is no adapter to ask with.
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-300">Languages</h2>
            <p className="text-xs text-zinc-500">
              Every one of the 22 can be written, pictured and queued. Two separate things decide
              whether a schedule may post in it <strong>unattended</strong>: somebody here can read it,
              and an abuse list exists for it. ⛔ Both, not either.
            </p>
          </div>
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {languages.map((l) => (
              <li key={l.code} className="space-y-2 bg-zinc-900/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{l.name}</span>
                  <span className="font-mono text-[11px] text-zinc-500">{l.code}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      l.reviewed ? "border-emerald-800 text-emerald-300" : "border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {l.reviewed ? "read by someone here" : "not read here"}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      l.abuse_list_ready ? "border-emerald-800 text-emerald-300" : "border-amber-800 text-amber-300"
                    }`}
                  >
                    {l.abuse_list_builtin
                      ? "abuse list in code"
                      : l.contributedTerms > 0
                        ? `${l.contributedTerms} terms contributed`
                        : "no abuse list"}
                  </span>
                  {l.mayPostUnattended && (
                    <span className="rounded-full border border-indigo-800 bg-indigo-950/40 px-2 py-0.5 text-[11px] text-indigo-300">
                      may post unattended
                    </span>
                  )}
                </div>
                {l.reason && <p className="text-[11px] leading-relaxed text-zinc-500">{l.reason}</p>}

                {isOwner && !l.abuse_list_builtin && (
                  termsFor === l.code ? (
                    <div className="space-y-2">
                      <label htmlFor={`t-${l.code}`} className="block text-[11px] font-semibold text-zinc-400">
                        Terms a speaker has sent, one per line or comma separated
                      </label>
                      <textarea
                        id={`t-${l.code}`}
                        rows={4}
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        placeholder="Both the native script and the Latin transliteration"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm"
                      />
                      <p className="text-[11px] text-zinc-500">
                        ⚠️ Abuse in these languages is written in Latin letters at least as often as in
                        its own script. A list with only one form checks half the posts.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void contribute(l.code)}
                          disabled={busy || !terms.trim()}
                          className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
                        >
                          Add them
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTermsFor("");
                            setTerms("");
                          }}
                          className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTermsFor(l.code)}
                      className="min-h-11 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Add abuse terms a speaker has sent →
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>

        {scripts.length > 0 && (
          <section className="space-y-2 rounded-xl border border-amber-900/60 bg-amber-950/20 p-5 text-sm text-amber-200">
            <h2 className="font-semibold">The brand name on a picture</h2>
            <p className="text-xs leading-relaxed">
              The renderer does not do full shaping for complex scripts, and nobody here can tell a
              correctly shaped brand name from a mangled one. So for these scripts the wordmark is set
              in Latin instead, and the post itself is still written in its own language:{" "}
              <span className="font-mono">{scripts.join(", ")}</span>.
            </p>
            <p className="text-xs leading-relaxed">
              ▶️ One person who reads a script looking at one rendered picture closes it. ⛔ Until then,
              publishing it would mean not knowing — which is how the Urdu and Kannada spellings were
              wrong for months.
            </p>
          </section>
        )}
          </>
        )}
      </div>
    </main>
  );
}
