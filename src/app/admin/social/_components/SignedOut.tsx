"use client";

// The panel every social admin screen shows when the admin session is absent.
//
// 🔴 WHY THIS EXISTS. All three screens used to set an error string and return
// — leaving the rest of the page rendering its REACT DEFAULTS as though they
// were loaded data. The channels screen said "Everything is held. Posts are
// still written and queued" and "No channel is connected"; the overview showed
// a confident `0` in every counter. None of it had been fetched. A page that
// states the system's condition when it has not been told the system's
// condition is worse than one that says nothing
// ⇒ ux_degradation_audit_2026_10_09, the silent-degrade class.
//
// ⚠️ AND THE CONFUSION IS REAL, not hypothetical. Being signed into Imotara
// does not sign you into here: the admin panel has its own `super_admins`
// session — email and password, no Google sign-in — so the top bar can show
// your address while this page has no session at all. ⇒ So the panel SAYS
// that, rather than repeating "not signed in" at somebody who plainly is.

export function SignedOut({ reason }: { reason?: string }) {
  return (
    <section className="space-y-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-6">
      <h2 className="text-base font-semibold text-amber-100">
        This page needs the admin sign-in, which is a separate one.
      </h2>
      <p className="max-w-2xl text-sm leading-relaxed text-amber-200/90">
        Being signed in to Imotara is not the same thing. The admin panel has its own account —
        an email and password held in <code className="font-mono text-amber-100">super_admins</code>,
        with no Google sign-in — so the bar at the top of this page can show your address while this
        screen has no session at all.
      </p>
      {reason && <p className="text-xs text-amber-200/70">{reason}</p>}
      <a
        href="/admin"
        className="inline-flex min-h-11 items-center rounded-lg bg-amber-200 px-5 text-sm font-semibold text-amber-950 hover:bg-amber-100"
      >
        Sign in at /admin
      </a>
      <p className="text-xs text-amber-200/60">
        ⛔ Nothing below is shown, deliberately. Until this page has been told what the system is
        doing, it has nothing true to say about it.
      </p>
    </section>
  );
}
