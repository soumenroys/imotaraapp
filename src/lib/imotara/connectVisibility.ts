// src/lib/imotara/connectVisibility.ts
//
// #108 (owner, 22 Nov 2026): "add a setting with selected as off. if user check it on, only then
// connect will be shown. otherwise it will not be visible" — web, Android and iOS, OFF by default.
//
// Why: Imotara Connect has had no live companions since 8 Nov, so the Connect tab led every
// visitor to an empty page. The pages themselves stay reachable by URL (a companion joining via
// /connect/register, a link in a mail) — only the places that INVITE people there follow this switch:
// the header tab and the chat tip "Explore Connect".
//
// Saved on this device only (like Appearance). ⛔ Missing / unreadable storage ⇒ OFF, never ON.

export const SHOW_CONNECT_KEY = "imotara.showConnect.v1";
export const SHOW_CONNECT_EVENT = "imotara:show-connect-changed";

export function readShowConnect(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SHOW_CONNECT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeShowConnect(on: boolean): void {
  try {
    window.localStorage.setItem(SHOW_CONNECT_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked — the switch still applies for this page view via the event */
  }
  try {
    window.dispatchEvent(new CustomEvent(SHOW_CONNECT_EVENT, { detail: on }));
  } catch {
    /* ignore */
  }
}
