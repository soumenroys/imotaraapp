"use client";

// The form that connects a channel.
//
// ⛔ IT TAKES A TOKEN, NEVER A LOGIN. The owner asked on 18 Oct whether a
// social password could be encrypted and stored so the app could sign in and
// post as them. It cannot usefully be:
//
//   • a hash is one-way — checkable, never usable to log in;
//   • encryption needs the plaintext back at post time, so the key sits beside
//     the ciphertext and anyone with both has the password;
//   • and none of these platforms allows programmatic password login anyway.
//
// 🔑 A token is better at the thing that was wanted: scoped to posting on one
// page, revocable on its own, and it SURVIVES A PASSWORD CHANGE — so changing
// a Facebook password does not break posting, where a stored password would
// break it every time.
//
// ⚠️ The field below says all of that, because somebody will otherwise paste a
// password into it once and wonder why it was refused.

import { useState } from "react";
import { PLATFORMS as CHANNELS, PLATFORM_IDS } from "@/lib/social/platforms";

/** Where the token comes from, per channel. ⚠️ Specific enough to follow —
 *  "get a token from the developer portal" is not instructions. */
const HOW: Record<string, string> = {
  facebook:
    "Meta Business Portfolio → Business settings → Users → System users → Add → assign the Imotara " +
    "Page → Generate token with pages_manage_posts, pages_read_engagement, pages_show_list. " +
    "⛔ No App Review needed for a Page the portfolio owns.",
  linkedin:
    "LinkedIn developer app → Community Management API → once approved, generate an access token " +
    "with w_organization_social. ⚠️ It expires in 60 days; the refresh token lasts a year.",
  instagram:
    "A separate permission set from the Facebook Page token, through the same portfolio.",
  x: "X developer portal → a project with write access. ⚠️ The API is paid.",
  youtube: "Google Cloud console → YouTube Data API → OAuth for the channel's own account.",
};

export function ConnectChannel({
  storageReady,
  onConnected,
  onCancel,
}: {
  storageReady: { ok: boolean; reason?: string };
  onConnected: (note: string) => void;
  onCancel: () => void;
}) {
  const [platform, setPlatform] = useState<string>("facebook");
  const [displayName, setDisplayName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const label = "block text-xs font-semibold text-zinc-400";
  const field = "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm";

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/social/channels", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform,
          displayName,
          externalId,
          accessToken,
          expiresAt: expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "That did not work.");
        return;
      }
      // ⛔ Cleared immediately. A token left in a form field survives a
      // screenshot, a screen share and a browser's own form restore.
      setAccessToken("");
      onConnected(json.note ?? "Connected.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-indigo-900/60 bg-indigo-950/10 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Connect a channel</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-zinc-400">
          This takes a <strong>token the platform issued</strong> — never a password. A token is
          scoped to posting on one page, you can revoke it on its own, and ⛔ it keeps working when
          you change your password, which a stored password would not.
        </p>
      </div>

      {!storageReady.ok && (
        <div className="rounded-lg border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">
          ⛔ Nothing can be stored yet. {storageReady.reason}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="cc-platform" className={label}>Channel</label>
          <select id="cc-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className={field}>
            {PLATFORM_IDS.map((id) => (
              <option key={id} value={id}>{CHANNELS[id].label}</option>
            ))}
          </select>
          <p className="text-[11px] leading-relaxed text-amber-300/90">
            ⛔ {CHANNELS[platform as keyof typeof CHANNELS].blockedBy}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="cc-name" className={label}>What to call it here</label>
          <input id="cc-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Imotara Page" className={field} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="cc-id" className={label}>The platform&rsquo;s own id for it</label>
        <input id="cc-id" value={externalId} onChange={(e) => setExternalId(e.target.value)}
          placeholder="e.g. the Page id" className={`${field} font-mono`} />
      </div>

      <div className="space-y-2">
        <label htmlFor="cc-token" className={label}>The token</label>
        <input id="cc-token" type="password" autoComplete="off" value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)} className={`${field} font-mono`} />
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Stored encrypted and never shown back — only its last four characters. ⛔ If you paste an
          email or a password here it will be refused, deliberately.
        </p>
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] leading-relaxed text-zinc-400">
          <strong className="text-zinc-300">Where to get it:</strong> {HOW[platform]}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="cc-exp" className={label}>When it expires (optional)</label>
        <input id="cc-exp" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
          className={field} />
        <p className="text-[11px] text-zinc-500">
          ⚠️ Set this if the platform gave you one. It is what lets the daily check warn you ten days
          out instead of the morning it stops.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
        <button type="button" onClick={() => void submit()}
          disabled={busy || !storageReady.ok || !displayName.trim() || !externalId.trim() || accessToken.length < 20}
          className="min-h-11 rounded-lg bg-indigo-600 px-5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40">
          {busy ? "Storing…" : "Connect it"}
        </button>
        <button type="button" onClick={onCancel}
          className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800">
          Cancel
        </button>
      </div>
    </section>
  );
}
