// src/lib/broadcast/resendClient.ts
// Sending layer for admin broadcast email (BC-04).
//
// Wraps the Resend SDK with the one thing the queue drain actually needs:
// a failure to be classified, not just reported. A rate limit and a malformed
// address both "fail", but one should be retried on the next tick and the
// other should never be tried again — and a revoked API key should stop the
// whole run rather than march through three thousand rows failing identically.

import "server-only";
import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY?.trim() ?? "";

// Resend caps a batch at 100 messages.
// See the @link in CreateBatchEmailOptions (node_modules/resend types) →
// resend.com/docs/dashboard/emails/batch-sending#limitations
export const MAX_BATCH = 100;

let client: Resend | null = null;
function resend(): Resend | null {
  if (!API_KEY) return null;
  if (!client) client = new Resend(API_KEY);
  return client;
}

export function isResendConfigured(): boolean {
  return API_KEY.length > 0;
}

// ── Failure classification ───────────────────────────────────────────────────
//
// The three kinds drive three different behaviours in the queue:
//
//   transient  → leave the row 'queued'; the next cron tick retries it
//   recipient  → mark that one row 'failed'; the rest of the run continues
//   fatal      → pause the whole broadcast; retrying cannot help and doing so
//                would burn the entire queue against a broken configuration
//
// The code list is the SDK's own RESEND_ERROR_CODE_KEY union, so it is
// exhaustive as of resend@6.26.0 rather than a guess at the API surface.

export type SendFailureKind = "transient" | "recipient" | "fatal";

const TRANSIENT = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "internal_server_error",
  "application_error",
  "concurrent_idempotent_requests",
]);

const RECIPIENT = new Set([
  "validation_error",
  "invalid_parameter",
  "missing_required_field",
  "invalid_attachment",
]);

// Everything else — missing/invalid/restricted API key, invalid_from_address,
// invalid_access, invalid_region, security_error, not_found,
// method_not_allowed, the idempotency-key errors — is a configuration or code
// fault. Retrying cannot fix it, and it will affect every message equally.
export function classifyResendError(code: string | undefined): SendFailureKind {
  if (!code) return "transient"; // network/unknown: safe to try again
  if (TRANSIENT.has(code)) return "transient";
  if (RECIPIENT.has(code)) return "recipient";
  return "fatal";
}

// ── Message + outcome shapes ─────────────────────────────────────────────────

export type BroadcastMessage = {
  from: string;              // "Name <addr@imotara.com>"
  to: string;                // one recipient per message — never a cc/bcc fan-out
  subject: string;
  html: string;
  text: string;              // always send a plain-text alternative
  replyTo?: string;
  headers?: Record<string, string>;  // List-Unsubscribe etc. (BC-07)
};

export type SendOutcome =
  | { ok: true;  email: string; id: string }
  | { ok: false; email: string; kind: SendFailureKind; code: string; message: string };

function payload(m: BroadcastMessage) {
  return {
    from: m.from,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    ...(m.headers ? { headers: m.headers } : {}),
  };
}

function notConfigured(email: string): SendOutcome {
  return {
    ok: false, email, kind: "fatal", code: "missing_api_key",
    message: "RESEND_API_KEY is not set",
  };
}

// ── Single send ──────────────────────────────────────────────────────────────

export async function sendOne(m: BroadcastMessage): Promise<SendOutcome> {
  const r = resend();
  if (!r) return notConfigured(m.to);

  try {
    const { data, error } = await r.emails.send(payload(m));
    if (error) {
      return {
        ok: false, email: m.to,
        kind: classifyResendError(error.name),
        code: error.name ?? "unknown",
        message: error.message ?? "Resend returned an error with no message",
      };
    }
    if (!data?.id) {
      // Accepted but no id — we cannot match a webhook to this row later, so
      // treat it as transient rather than recording a send we can't track.
      return {
        ok: false, email: m.to, kind: "transient", code: "no_id_returned",
        message: "Resend accepted the message but returned no id",
      };
    }
    return { ok: true, email: m.to, id: data.id };
  } catch (e) {
    // Thrown rather than returned: network failure, DNS, timeout.
    return {
      ok: false, email: m.to, kind: "transient", code: "network_error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

// ── Batch send ───────────────────────────────────────────────────────────────
//
// Uses batchValidation: 'permissive'. The default is 'strict', where ONE
// malformed address rejects all 100 — unusable for a drain over a list nobody
// has hand-checked.
//
// VERIFIED 2026-09-03 against the live API. A batch of 3 with index 1
// malformed returned:
//
//   data.data   → 2 ids, the successes IN INPUT ORDER (indices 0 and 2)
//   data.errors → [{ index: 1, message: "Invalid `to` field. …" }]
//
// So ids map to the non-failed inputs in order, and errors[].index points at
// the failures. The reconciliation guard below is kept anyway: getting this
// wrong would write a Resend id onto the wrong recipient's row and silently
// mis-route every subsequent webhook for both of them, so a count mismatch
// downgrades the batch to individual retry rather than trusting the mapping.
//
// The same response also reported `ratelimit-policy: 10;w=1` — ten requests
// per second. At 100 messages per request that ceiling is nowhere near
// binding for the cron in BC-05.

export async function sendBatch(messages: BroadcastMessage[]): Promise<SendOutcome[]> {
  if (messages.length === 0) return [];
  if (messages.length > MAX_BATCH) {
    throw new Error(`sendBatch: ${messages.length} messages exceeds the ${MAX_BATCH} cap`);
  }

  const r = resend();
  if (!r) return messages.map((m) => notConfigured(m.to));

  try {
    const { data, error } = await r.batch.send(
      messages.map(payload),
      { batchValidation: "permissive" },
    );

    // Whole-request failure — auth, rate limit, malformed request.
    if (error) {
      const kind = classifyResendError(error.name);
      return messages.map((m) => ({
        ok: false as const, email: m.to, kind,
        code: error.name ?? "unknown",
        message: error.message ?? "Resend rejected the batch",
      }));
    }

    const ids: { id: string }[] = data?.data ?? [];
    const errs: { index: number; message: string }[] =
      (data as { errors?: { index: number; message: string }[] } | null)?.errors ?? [];

    // The reconciliation guard described above.
    if (ids.length + errs.length !== messages.length) {
      return messages.map((m) => ({
        ok: false as const, email: m.to, kind: "transient" as const,
        code: "batch_unmappable",
        message:
          `Batch returned ${ids.length} ids and ${errs.length} errors for ` +
          `${messages.length} messages; cannot map ids to recipients safely. ` +
          `Retrying individually.`,
      }));
    }

    const failedIdx = new Set(errs.map((e) => e.index));
    const errByIdx = new Map(errs.map((e) => [e.index, e.message]));

    const out: SendOutcome[] = [];
    let idCursor = 0;
    messages.forEach((m, i) => {
      if (failedIdx.has(i)) {
        // Per-message batch errors are validation failures on that address.
        out.push({
          ok: false, email: m.to, kind: "recipient",
          code: "validation_error",
          message: errByIdx.get(i) ?? "Rejected in batch validation",
        });
      } else {
        const id = ids[idCursor++]?.id;
        out.push(
          id
            ? { ok: true, email: m.to, id }
            : {
                ok: false, email: m.to, kind: "transient",
                code: "no_id_returned",
                message: "Batch reported success but returned no id for this message",
              },
        );
      }
    });
    return out;
  } catch (e) {
    return messages.map((m) => ({
      ok: false as const, email: m.to, kind: "transient" as const,
      code: "network_error",
      message: e instanceof Error ? e.message : String(e),
    }));
  }
}
