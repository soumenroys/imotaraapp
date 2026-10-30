// src/components/analytics/VisitTally.tsx
//
// Starts the anonymous visit tally on every visitor page and reports the visit
// when the page is hidden. ⇒ lib/analytics/visitTallyClient.ts
//
// Not on /admin or /unsubscribe — our own work and mail scanners are not
// visitors ⇒ lib/analytics/ga.ts isUntrackedPath.
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isUntrackedPath } from "@/lib/analytics/ga";
import { noteVisit, reportVisit } from "@/lib/analytics/visitTallyClient";

export default function VisitTally() {
    const pathname = usePathname();
    const untracked = isUntrackedPath(pathname);

    useEffect(() => {
        if (untracked) return;
        noteVisit();
        const onHide = () => { if (document.visibilityState === "hidden") reportVisit(); };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onHide);
        return () => {
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", onHide);
        };
    }, [untracked]);

    return null;
}
