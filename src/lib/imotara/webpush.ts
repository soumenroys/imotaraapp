// src/lib/imotara/webpush.ts
// Server-only utility for sending Web Push notifications via VAPID.
//
// Required env vars (set in Vercel dashboard):
//   VAPID_SUBJECT       — mailto:your@email.com
//   VAPID_PUBLIC_KEY    — base64url public key
//   VAPID_PRIVATE_KEY   — base64url private key
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — same public key, exposed to browser
//
// Generate keys once with: npx web-push generate-vapid-keys

import webpush from "web-push";

let initialised = false;

function init() {
  if (initialised) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID env vars not configured (VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialised = true;
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  url?: string;
};

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; gone: boolean }> {
  init();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err: any) {
    // 410 Gone = subscription expired/unsubscribed — safe to delete from DB
    return { ok: false, gone: err?.statusCode === 410 || err?.statusCode === 404 };
  }
}
