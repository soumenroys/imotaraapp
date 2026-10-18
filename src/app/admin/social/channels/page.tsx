"use client";

// /admin/social/channels — the places posts go, and whether they work.
//
// ⚠️ This page used to carry the master switch, the connect form, the
// connections, ALL 22 LANGUAGES and the font-script note — ~1,800 words on one
// scroll. The languages moved to their own screen; what is left is one job.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { PageTutorial, TUTORIALS } from "@/app/admin/social/_components/PageTutorial";
import { ConnectChannel } from "@/app/admin/social/_components/ConnectChannel";
import { SocialPage, Chip, Explain, CHANNEL_STATUS } from "@/app/admin/social/_components/ui";

type Account = {
  id: string;
  platform: string;
  display_name: string;
  token_tail: string | null;
  token_expires_at: string | null;
  status: string;
  last_verified_at: string | null;
  last_error: string | null;
};
type Channel = { id: string; label: string; canPublish: boolean; blockedBy: string };

export default function Channels() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [paused, setPaused] = useState(true);
  const [storage, setStorage] = useState<{ ok: boolean; reason?: string }>({ ok: false });
  const [role, setRole] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // ⚠️ Per account, not one flag. One flag disables every row's button while
  // any row is checking, which reads as the page having frozen.
  const [checking, setChecking] = useState<string | null>(null);

  const isOwner = role === "owner";

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social/channels", { credentials: "same-origin" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const json = await res.json();
    setAccounts(json.accounts ?? []);
    setChannels(json.channels ?? []);
    setPaused(Boolean(json.settings?.posting_paused));
    setStorage(json.tokenStorage ?? { ok: false, reason: "The server did not say." });
    setRole(json.actorRole ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePause() {
    setBusy(true);
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

  const connected = new Set(accounts.map((a) => a.platform));

  /**
   * 🔑 THE MOMENT A TOKEN IS PASTED IS THE ONLY MOMENT somebody is standing
   * there able to fix it. Leaving verification to the daily cron turns a
   * thirty-second correction into a day of nothing being posted.
   */
  async function checkNow(accountId: string) {
    setChecking(accountId);
    try {
      const res = await fetch(`/api/admin/social/channels/${accountId}/check`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      setMessage(res.ok ? json.note : json.error);
      if (res.ok) await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setChecking(null);
    }
  }

  return (
    <SocialPage
      here="/admin/social/channels"
      title="Channels"
      lede="Where posts go. Connected with a token the platform gives you — never a password."
      actions={
        authed === true && isOwner ? (
          <button
            type="button"
            onClick={() => setConnecting((c) => !c)}
            className="flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500"
          >
            {connecting ? "Close" : "Connect a channel"}
          </button>
        ) : undefined
      }
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <>

        <PageTutorial id="channels" {...TUTORIALS.channels} />

          {message && (
            <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">
              {message}
            </div>
          )}

          {connecting && isOwner && (
            <ConnectChannel
              storageReady={storage}
              onCancel={() => setConnecting(false)}
              onConnected={(note) => {
                setConnecting(false);
                setMessage(note);
                void load();
              }}
            />
          )}

          {/* One row per channel, connected or not: the answer to "can I post
              there?" is the same shape either way. */}
          <ul className="space-y-3">
            {channels.map((c) => {
              const account = accounts.find((a) => a.platform === c.id);
              const s = account ? CHANNEL_STATUS[account.status] ?? CHANNEL_STATUS.pending : null;
              return (
                <li key={c.id} className="space-y-2 rounded-xl border border-white/8 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.label}</span>
                    {account ? (
                      <Chip tone={s!.tone} title={s!.means}>{s!.label}</Chip>
                    ) : (
                      <Chip>Not connected</Chip>
                    )}
                  </div>

                  {account ? (
                    <>
                      <p className="font-mono text-[11px] text-zinc-500">
                        {account.display_name} · token ···{account.token_tail ?? "????"}
                        {account.token_expires_at &&
                          ` · expires ${new Date(account.token_expires_at).toLocaleDateString()}`}
                      </p>
                      {s && <p className="text-xs text-zinc-400">{s.means}</p>}
                      {account.last_error && <p className="text-xs text-rose-300">{account.last_error}</p>}

                      {/* ⚠️ Offered on every connected channel, including the
                          ones with no adapter — the refusal then NAMES the
                          channel that cannot be checked, which is more use
                          than a button that is not there to press. */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => void checkNow(account.id)}
                          disabled={checking !== null}
                          className="min-h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"
                        >
                          {checking === account.id ? "Asking the platform…" : "Check it now"}
                        </button>
                        <span className="text-[11px] text-zinc-500">
                          {account.last_verified_at
                            ? `Last checked ${new Date(account.last_verified_at).toLocaleString()}`
                            : "Never checked."}
                        </span>
                      </div>
                      {(account.status === "dead" || account.status === "expiring") && (
                        <p className="text-xs text-amber-300">
                          ▶️ Generate a new token on the platform and connect it again. ⛔ Your password
                          is not involved — changing it does not break posting.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-zinc-500">{c.blockedBy}</p>
                  )}
                </li>
              );
            })}
          </ul>

          {!storage.ok && (
            <p className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
              ⛔ No channel can be connected yet. {storage.reason}
            </p>
          )}

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/5 p-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">
                Stop everything {!isOwner && <span className="text-xs font-normal text-zinc-500">· owner only</span>}
              </h2>
              <p className="max-w-xl text-xs text-zinc-400">
                {paused
                  ? "Everything is held. Posts are still written and queued; nothing goes out."
                  : "Posting is live. Posts go out as normal."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void togglePause()}
              disabled={busy || !isOwner}
              title={isOwner ? undefined : "Only the owner can change this."}
              className={`min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-40 ${
                paused ? "bg-indigo-600 hover:bg-indigo-500" : "border border-amber-800 text-amber-300 hover:bg-amber-950/40"
              }`}
            >
              {paused ? "Start posting again" : "Stop everything"}
            </button>
          </section>

          <Explain q="Why a token and not my password?">
            <p>
              A token only lets this app post to one page. It cannot read your messages, change your
              account, or do anything else — and you can cancel it on the platform at any time.
            </p>
            <p>
              ⛔ A password would be the whole account, and it would have to be stored in a form this
              app could read back, which means anybody who got the database could read it too.
            </p>
            <p>
              🔑 And a token <strong>keeps working when you change your password</strong>. Storing a
              password would break posting every time you changed it.
            </p>
          </Explain>

          {connected.size === 0 && (
            <p className="text-xs text-zinc-500">
              ⛔ Connecting a channel does not make posting work yet — the code that actually sends to
              each platform is not built. A connected channel holds its queue until it is.
            </p>
          )}
        </>
      )}
    </SocialPage>
  );
}
