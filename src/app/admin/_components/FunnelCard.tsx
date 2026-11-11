"use client";
// Admin → Analytics: the anonymous funnel (#129, 11 Nov 2026). Counted once per device per day per
// step — so these are "devices that reached the step that day", never people or names.
import { useEffect, useState } from "react";
import { Card } from "@/app/admin/_components/ui";
import type { FunnelSummary } from "@/lib/analytics/funnelSummary";

const LABEL: Record<string, string> = {
  invite_shown: "Check-in invite shown", invite_accepted: "Invite accepted", invite_declined: "Invite declined",
  welcome_shown: "Welcome-back shown", welcome_pick: "Welcome-back → Pick up", welcome_fresh: "Welcome-back → Start fresh",
  checkin_opened: "Check-in reminder opened", upgrade_view: "Upgrade page viewed", checkout_start: "Checkout started",
  purchase_ok: "Payment done", purchase_cancel: "Checkout closed / failed", quota_hit: "Daily free limit reached",
  landing_send: "Landing box → Send pressed", landing_sent: "Landing message sent in chat",
};
const rate = (v: number | null) => (v === null ? "—" : `${v}%`);

export default function FunnelCard({ days }: { days: number }) {
  const [d, setD] = useState<(FunnelSummary & { ok: boolean }) | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let off = false;
    fetch(`/api/admin/funnel?days=${days}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (!off) setD(j); })
      .catch(() => { if (!off) setErr(true); });
    return () => { off = true; };
  }, [days]);
  return (
    <Card title="Funnel (anonymous)" hint="Devices reaching each step, counted once per device per day. Web from 11 Nov 2026; the apps from their next release. No names, no accounts.">
      {err && <p className="text-sm text-zinc-500">Could not load the funnel.</p>}
      {d && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-zinc-300 md:grid-cols-4">
            <div>Landing box → sent in chat: <b>{rate(d.rates.landingCarried)}</b></div>
            <div>Invite accepted: <b>{rate(d.rates.inviteAccepted)}</b></div>
            <div>Welcome-back picked: <b>{rate(d.rates.welcomePicked)}</b></div>
            <div>Upgrade → checkout: <b>{rate(d.rates.viewToCheckout)}</b></div>
            <div>Checkout → paid: <b>{rate(d.rates.checkoutToPaid)}</b></div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-zinc-500"><th className="py-1">Step</th><th>Web</th><th>iPhone</th><th>Android</th><th>Total</th></tr></thead>
            <tbody>
              {d.steps.map((s) => (
                <tr key={s.step} className="border-t border-white/5 text-zinc-300">
                  <td className="py-1">{LABEL[s.step] ?? s.step}</td><td>{s.web}</td><td>{s.ios}</td><td>{s.android}</td><td className="font-semibold">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}
