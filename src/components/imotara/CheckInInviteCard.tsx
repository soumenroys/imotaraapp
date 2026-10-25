"use client";
// src/components/imotara/CheckInInviteCard.tsx
// The one-time "Shall I check in with you tomorrow?" card ⇒ lib/imotara/checkInInviteStrings.
// Mirrors the phone's card. ⛔ The browser asks for permission only after a time is tapped.

import { useState } from "react";
import Link from "next/link";
import { isRtlLang } from "@/lib/lang/rtlLangs";
import { formatHour, getInviteStrings, INVITE_HOURS, setInviteState } from "@/lib/imotara/checkInInviteStrings";
import { enableDailyCheckIn } from "@/lib/imotara/enableDailyCheckIn";

export default function CheckInInviteCard(props: {
    lang?: string;
    onDone: (toast: { message: string; type: "info" | "error" } | null) => void;
}) {
    const s = getInviteStrings(props.lang);
    const rtl = isRtlLang(props.lang);
    const [busy, setBusy] = useState(false);

    async function pick(hour: number) {
        if (busy) return;
        setBusy(true);
        const r = await enableDailyCheckIn(hour);
        setBusy(false);
        if (r.ok) {
            setInviteState("accepted");
            props.onDone({ message: s.done(formatHour(hour, props.lang)), type: "info" });
        } else if (r.reason === "failed") {
            // 🔴 OUR failure, not theirs (25 Oct: the server refused every subscription).
            //    Say so, and leave the card offerable next time instead of retiring it.
            props.onDone({ message: "Couldn't save the reminder just now — please try again later.", type: "error" });
        } else {
            // ⛔ Declined or unavailable: retire the card rather than ask again.
            setInviteState("declined");
            props.onDone({ message: s.blocked, type: "error" });
        }
    }

    const chip = "rounded-xl px-3.5 py-2 text-[12px] font-semibold transition disabled:opacity-50";
    return (
        <div className="flex justify-start animate-fade-in px-1" dir={rtl ? "rtl" : "ltr"}>
            {/* ⚠️ im-quota-card: the site's own light theme overrides this card's dark background,
                as it does for the quota card. Without it, a dark-mode computer showing the light
                site drew dark text on a dark box (seen live, 25 Oct). */}
            <div className="im-quota-card w-full max-w-[82%] rounded-2xl border border-violet-500/25 bg-zinc-100 dark:bg-[#1e1028] p-4 shadow-lg">
                <p className="text-[14px] font-medium text-zinc-800 dark:text-zinc-200">🌙 {s.q}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{s.sub}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => void pick(INVITE_HOURS.evening)}
                        className={`${chip} bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90`}>
                        🌙 {formatHour(INVITE_HOURS.evening, props.lang)}
                    </button>
                    <button disabled={busy} onClick={() => void pick(INVITE_HOURS.morning)}
                        className={`${chip} border border-violet-500/35 text-zinc-800 dark:text-zinc-200 hover:bg-violet-500/10`}>
                        ☀️ {formatHour(INVITE_HOURS.morning, props.lang)}
                    </button>
                    <Link href="/settings" onClick={() => { setInviteState("declined"); props.onDone(null); }}
                        className={`${chip} border border-violet-500/35 text-zinc-800 dark:text-zinc-200 hover:bg-violet-500/10`}>
                        {s.choose}
                    </Link>
                    <button disabled={busy} onClick={() => { setInviteState("declined"); props.onDone(null); }}
                        className={`${chip} text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300`}>
                        {s.later}
                    </button>
                </div>
            </div>
        </div>
    );
}
