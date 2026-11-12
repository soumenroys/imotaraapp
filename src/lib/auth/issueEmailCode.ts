// src/lib/auth/issueEmailCode.ts — #134 (12 Nov 2026): a 6-digit sign-in code for ANY email address,
// made by OUR server and sent from OUR mailbox. ⇒ api/auth/email-code · lib/auth/codeMailer.ts
//
// Why our server and not supabase.auth.signInWithOtp(): Supabase's "allow new sign-ups" stays OFF
// (decided July 2026 — accounts are only ever created here, behind our rate limits), and Supabase
// would send the mail itself through its own mailer. Here:
//   1. create the account if the email is new (unconfirmed — the code confirms it)
//   2. ask Supabase for a one-time code WITHOUT it sending anything (admin.generateLink)
//   3. email the code ourselves
// The browser / app then calls supabase.auth.verifyOtp({ email, token, type: "email" }).
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendSignInCodeEmail, type CodePurpose } from "@/lib/auth/codeMailer";

export type IssueResult = { ok: true } | { ok: false; reason: "mail" | "auth" };

export async function issueEmailCode(email: string, purpose: CodePurpose): Promise<IssueResult> {
  const admin = getSupabaseAdmin();

  // 1. New address ⇒ make the account. "Already registered" is the normal case for a returning
  //    person (any way they signed up before — Google, Apple, a password) and is not an error.
  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: false });
  if (createErr && !/already|registered|exists/i.test(createErr.message)) {
    console.error("[auth/issueEmailCode] createUser:", createErr.message);
    return { ok: false, reason: "auth" };
  }

  // 2. The code — Supabase makes it and remembers it, but sends nothing.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const code = data?.properties?.email_otp;
  if (error || !code) {
    console.error("[auth/issueEmailCode] generateLink:", error?.message ?? "no code returned");
    return { ok: false, reason: "auth" };
  }

  // 3. Our mailbox.
  return (await sendSignInCodeEmail(email, code, purpose)) ? { ok: true } : { ok: false, reason: "mail" };
}
