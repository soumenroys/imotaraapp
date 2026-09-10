"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Renders the site footer everywhere except on full-height app routes.
 *
 * A footer is a document convention: it marks where a page ends and you scroll
 * to it deliberately. The chat is not a document — it is an app screen that
 * should end at the bottom of the window. With the footer below it, the page
 * ran to 1306px on a 768px viewport, so the browser showed its own scrollbar
 * on top of the message list's and the app claimed there was more below when
 * there was nothing anyone was looking for.
 *
 * Nothing is lost by hiding it here: Privacy and Terms are in the header's
 * overflow menu on every page (SiteHeader.tsx), and the chat body links to
 * /privacy itself.
 *
 * Takes the footer as `children` rather than importing it, so SiteFooter stays
 * a server component and none of its markup ships as client JS.
 */

/** Routes that own the full viewport. Prefix match, so /chat/anything counts. */
const APP_SCREENS = ["/chat"];

function isAppScreen(pathname: string | null): boolean {
    if (!pathname) return false;
    return APP_SCREENS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default function SiteFooterSlot({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const appScreen = isAppScreen(pathname);

    // body carries pb-24 to keep content clear of MobileTabBar — which is
    // `sm:hidden`, so above 640px that padding reserves room for a bar that
    // does not exist. Harmless on a document that scrolls anyway; on a screen
    // meant to end at the fold it is 96px of pure scroll. Cleared by class
    // rather than by editing the body className, so every other route keeps
    // exactly what it had.
    useEffect(() => {
        const cls = "app-screen";
        document.body.classList.toggle(cls, appScreen);
        return () => document.body.classList.remove(cls);
    }, [appScreen]);

    if (appScreen) return null;
    return <>{children}</>;
}
