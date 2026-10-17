"use client";

// /admin/social/languages — which of the 22 can post on their own, and why not.
//
// 🔴 THIS PAGE EXISTS BECAUSE THE CHANNELS SCREEN HAD FOUR UNRELATED THINGS ON
// IT and ran to ~1,800 words, of which ~750 were the SAME PARAGRAPH REPEATED
// NINETEEN TIMES — once per language nobody here reads.
//
// ⚠️ The paragraph was true. Printing it nineteen times meant nobody read it
// once. ⇒ It is said ONCE, above the table, and each row carries only what
// differs: two ticks and, where it matters, a short reason.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { PageTutorial, TUTORIALS } from "@/app/admin/social/_components/PageTutorial";
import { SocialPage, Chip, Explain } from "@/app/admin/social/_components/ui";

type Row = {
  code: string;
  name: string;
  reviewed: boolean;
  abuse_list_ready: boolean;
  abuse_list_builtin: boolean;
  contributedTerms: number;
  mayPostUnattended: boolean;
  reason: string | null;
};

export default function Languages() {
  const [rows, setRows] = useState<Row[]>([]);
  const [role, setRole] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [openFor, setOpenFor] = useState("");
  const [terms, setTerms] = useState("");

  const isOwner = role === "owner";

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social/languages", { credentials: "same-origin" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const json = await res.json();
    setRows(json.languages ?? []);
    setRole(json.actorRole ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function contribute(code: string) {
    const list = terms.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/social/languages", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: code, terms: list }),
      });
      const json = await res.json();
      setMessage(res.ok ? json.note : json.error);
      if (res.ok) {
        setTerms("");
        setOpenFor("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  const ready = rows.filter((r) => r.mayPostUnattended);

  return (
    <SocialPage
      here="/admin/social/languages"
      title="Languages"
      lede="All 22 can be written and queued. Only some can go out without you reading them first."
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <>

        <PageTutorial id="languages" {...TUTORIALS.languages} />

          {message && (
            <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">
              {message}
            </div>
          )}

          {/* 🔑 Said ONCE. The nineteen copies are gone, not the explanation. */}
          <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <p className="text-sm text-zinc-300">
              A language can post <strong>on its own</strong> only when two separate things are true:
              somebody here can read it, <em>and</em> there is a word list to check it against.
              Right now that is{" "}
              <strong>{ready.length === 0 ? "none of them" : ready.map((r) => r.name).join(", ")}</strong>.
            </p>
            <Explain q="Why both, and not either?">
              <p>
                A reply inside the app is read by one person and then gone. A post is permanent,
                quotable and screenshot — so the bar is higher.
              </p>
              <p>
                <strong>Someone reads it</strong> means a bad draft would be noticed. Without that, a
                post that sounded like a translation, or worse, goes out unseen.
              </p>
              <p>
                <strong>A word list exists</strong> means the abuse check actually runs. ⛔ We will not
                invent lists for languages nobody here reads: a wrong list is invisibly wrong and
                reports success, which is worse than having none.
              </p>
              <p>
                ⚠️ Bengali and Hindi pass the first and fail the second today. That is the whole
                reason they are two conditions and not one.
              </p>
            </Explain>
          </section>

          <section className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="p-3 font-semibold">Language</th>
                  <th scope="col" className="p-3 font-semibold">Someone reads it</th>
                  <th scope="col" className="p-3 font-semibold">Word list</th>
                  <th scope="col" className="p-3 font-semibold">Can post on its own</th>
                  {isOwner && <th scope="col" className="p-3 font-semibold" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-b border-zinc-900 last:border-0">
                    <td className="p-3">
                      <span className="font-medium">{r.name}</span>
                    </td>
                    <td className="p-3">
                      {r.reviewed ? <Chip tone="green">Yes</Chip> : <Chip>Not yet</Chip>}
                    </td>
                    <td className="p-3">
                      {r.abuse_list_builtin ? (
                        <Chip tone="green">Built in</Chip>
                      ) : r.contributedTerms > 0 ? (
                        <Chip tone="green">{r.contributedTerms} words</Chip>
                      ) : (
                        <Chip>None</Chip>
                      )}
                    </td>
                    <td className="p-3">
                      {r.mayPostUnattended ? (
                        <Chip tone="indigo">Yes</Chip>
                      ) : (
                        <Chip tone="amber" title={r.reason ?? undefined}>
                          Waits for you
                        </Chip>
                      )}
                    </td>
                    {isOwner && (
                      <td className="p-3 text-right">
                        {!r.abuse_list_builtin && (
                          <button
                            type="button"
                            onClick={() => setOpenFor(openFor === r.code ? "" : r.code)}
                            className="min-h-11 text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            {openFor === r.code ? "Close" : "Add words"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {openFor && isOwner && (
            <section className="space-y-3 rounded-xl border border-indigo-900/60 bg-indigo-950/10 p-5">
              <h2 className="text-sm font-semibold">
                Words a speaker has sent for {rows.find((r) => r.code === openFor)?.name}
              </h2>
              <textarea
                rows={4}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="One per line, or comma separated"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm"
              />
              <Explain q="What should be in this list?">
                <p>
                  Words that must never appear in a post: abuse, profanity, anything demeaning.
                </p>
                <p>
                  ⚠️ <strong>Both the native script and the Latin spelling.</strong> Abuse in these
                  languages is typed in Latin letters at least as often as in its own script, so a
                  list with only one form checks half the posts.
                </p>
                <p>
                  ⛔ Adding words does not mean the language can post on its own — somebody still has
                  to be able to read it.
                </p>
              </Explain>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void contribute(openFor)}
                  disabled={busy || !terms.trim()}
                  className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
                >
                  Add them
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenFor("");
                    setTerms("");
                  }}
                  className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
            <h2 className="text-sm font-semibold text-zinc-300">The brand name on pictures</h2>
            <p className="text-sm text-zinc-400">
              On a post in Bengali, Tamil, Urdu and nine other scripts, the picture shows{" "}
              <strong>Imotara</strong> in Latin letters. The post itself is still in its own language.
            </p>
            <Explain q="Why not in its own script?">
              <p>
                The picture renderer does not lay out complex scripts properly — conjuncts and
                joining letters come out wrong — and nobody here can tell a correct brand name from a
                mangled one.
              </p>
              <p>
                ⛔ Publishing it would mean not knowing. That is exactly how the Urdu and Kannada
                spellings were wrong for months.
              </p>
              <p>▶️ One person who reads a script, looking at one rendered picture, closes this.</p>
            </Explain>
          </section>
        </>
      )}
    </SocialPage>
  );
}
