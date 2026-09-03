// src/lib/broadcast/unsubscribe.ts
// Unsubscribe tokens and headers (BC-07, token half).
//
// Gmail and Yahoo have required one-click unsubscribe (RFC 8058) from bulk
// senders since early 2024. Its absence is not a cosmetic omission — it
// raises spam-folder placement, which is the outcome all of this exists to
// avoid.
//
// The token is an HMAC rather than a database row on purpose: a mail client
// may hit the one-click endpoint automatically, from anywhere, months later.
// A stateless signed token stays valid without keeping a lookup table alive,
// and cannot be enumerated to unsubscribe someone else.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// A dedicated secret is preferable. NEXTAUTH_SECRET is accepted as a fallback
// so this works without new configuration; both are already server-only.
const SECRET =
  process.env.BROADCAST_UNSUBSCRIBE_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  "";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://www.imotara.com";

export function isUnsubscribeConfigured(): boolean {
  return SECRET.length > 0;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/**
 * Token for one recipient of one broadcast.
 * Binding the broadcast id means a leaked token cannot be replayed to
 * unsubscribe the same person from some unrelated future send, and it records
 * which message prompted the opt-out.
 */
export function makeUnsubscribeToken(email: string, broadcastId: string): string {
  const body = `${email.toLowerCase()}:${broadcastId}`;
  return `${Buffer.from(body).toString("base64url")}.${sign(body)}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { email: string; broadcastId: string } | null {
  if (!SECRET) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(body);
  // Constant-time compare — a fast-exit compare here would leak the signature
  // one byte at a time to anyone willing to iterate.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const idx = body.lastIndexOf(":");
  if (idx <= 0) return null;
  return { email: body.slice(0, idx), broadcastId: body.slice(idx + 1) };
}

/** The link a PERSON clicks: a page that asks before doing anything. */
export function unsubscribeUrl(email: string, broadcastId: string): string {
  return `${SITE}/unsubscribe?t=${makeUnsubscribeToken(email, broadcastId)}`;
}

/**
 * The URL a MAIL PROVIDER posts to for RFC 8058 one-click.
 *
 * It has to be the API route, not the page: Gmail sends a POST and a page
 * route answers 405, at which point Gmail stops showing the unsubscribe button
 * for this sender — and the next person who wants out presses "Report spam"
 * instead, which costs far more reputation.
 */
export function unsubscribePostUrl(email: string, broadcastId: string): string {
  return `${SITE}/api/unsubscribe?t=${makeUnsubscribeToken(email, broadcastId)}`;
}

/**
 * Headers for a 'broadcast'-type message.
 *
 * Returns nothing for 'operational' mail — a seat-renewal notice or an account
 * change is not optional, so offering to unsubscribe from it would be a lie,
 * and the absence of these headers is part of why such mail reaches the
 * Primary tab rather than Promotions.
 *
 * List-Unsubscribe-Post is what makes it ONE-CLICK: without it a client shows
 * a link, with it the client can unsubscribe on the reader's behalf.
 */
export function unsubscribeHeaders(
  messageType: "broadcast" | "operational",
  email: string,
  broadcastId: string,
): Record<string, string> | undefined {
  if (messageType !== "broadcast") return undefined;
  if (!SECRET) return undefined;
  return {
    "List-Unsubscribe": `<${unsubscribePostUrl(email, broadcastId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Visible footer. Required alongside the header, not instead of it. */
export function unsubscribeFooterHtml(email: string, broadcastId: string): string {
  return (
    `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #eef2f7;` +
    `font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#94a3b8">` +
    `You are receiving this because you gave us your address. ` +
    `<a href="${unsubscribeUrl(email, broadcastId)}" style="color:#4f46e5">Unsubscribe</a>` +
    ` &middot; Imotara, Kolkata, India</div>`
  );
}

export function unsubscribeFooterText(email: string, broadcastId: string): string {
  return (
    `\n\n—\nYou are receiving this because you gave us your address.\n` +
    `Unsubscribe: ${unsubscribeUrl(email, broadcastId)}\n` +
    `Imotara, Kolkata, India`
  );
}
