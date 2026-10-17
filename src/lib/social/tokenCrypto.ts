// src/lib/social/tokenCrypto.ts
// Encrypting the platform tokens before they touch the database.
//
// 🔑 WHY THIS IS ENCRYPTION AND NOT HASHING, since the two get conflated and
// the difference decides what is possible here.
//
//   • A HASH is one-way. `super_admins.password_hash` is scrypt: it can be
//     CHECKED against a password and never turned back into one, which is why
//     a stolen copy is close to worthless.
//   • A TOKEN has to be USED. It is sent to Facebook on every post, so it must
//     come back out as plaintext — which means this is reversible by whoever
//     holds the key, and the key lives in the same place as the ciphertext.
//
// ⚠️ SO BE HONEST ABOUT WHAT THIS DEFENDS AGAINST. It defends against a
// database copy alone: a leaked backup, a mis-scoped read, the July 2026
// failure where the anon key could read a table. ⛔ It does NOT defend against
// anybody who can read both the rows and the environment. Nothing reversible
// can.
//
// 🔑 AND THAT IS EXACTLY WHY A PASSWORD IS NOT STORED HERE, and why a token is
// better than one at the thing the owner asked for:
//   • a token is scoped to posting on one page — a password is the whole
//     account, including the messages and the recovery address;
//   • a token is revoked on its own, without changing anything else;
//   • ⛔ and a token SURVIVES A PASSWORD CHANGE, so changing a Facebook
//     password does not break posting. A stored password would break it every
//     time, which is the opposite of what was wanted.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";

/**
 * The key, from `SOCIAL_TOKEN_KEY` — 32 bytes, base64.
 *
 * ⛔ NO FALLBACK, NO DERIVED-FROM-SOMETHING-ELSE, NO DEFAULT. A key quietly
 * derived from another secret means rotating that secret silently destroys
 * every stored token, and a default key means the encryption is theatre. A
 * missing key is a refusal to store, which is the only safe failure.
 */
function key(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_KEY?.trim();
  if (!raw) {
    throw new Error(
      "SOCIAL_TOKEN_KEY is not set, so a platform token cannot be stored. " +
        "⛔ Refusing rather than writing a credential in plain text: a token in a plain column " +
        "outlives the intention to protect it later. Generate 32 random bytes, base64 them, and " +
        "set it in the environment.",
    );
  }
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) {
    throw new Error(
      `SOCIAL_TOKEN_KEY decodes to ${k.length} bytes; aes-256-gcm needs exactly 32. ` +
        "⚠️ A short key is not a weaker key here — it is a crash at the moment a post would publish.",
    );
  }
  return k;
}

/** Is the key present and the right shape? For the admin to show, without
 *  anybody having to try a write to find out. */
export function tokenStorageReady(): { ok: boolean; reason?: string } {
  try {
    key();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/**
 * Encrypt a token, bound to the row it belongs to.
 *
 * ⚠️ `aad` IS NOT DECORATION. Without it, ciphertext from one row decrypts
 * perfectly in another — so a write that swapped two rows' tokens would post
 * to the wrong channel with the wrong credential and nothing would error. The
 * platform and the platform's own id for the account are bound in, so a
 * swapped row fails to decrypt instead.
 */
export function encryptToken(plain: string, aad: string): string {
  if (!plain) throw new Error("tokenCrypto: refusing to encrypt an empty token.");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptToken(payload: string, aad: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(
      `tokenCrypto: this is not a ${VERSION} payload. ⛔ Not attempted as plaintext — a value that ` +
        "fails to parse is a bug or a tamper, and using it anyway would be using an unknown string " +
        "as a credential.",
    );
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  // ⚠️ GCM throws here if the ciphertext, the tag or the aad is wrong. That
  // throw is the authentication; it must never be caught and ignored.
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** The binding for a given account row. ⛔ Must be stable: change it and every
 *  stored token for that row stops decrypting. */
export function tokenAad(platform: string, externalId: string): string {
  return `${platform}:${externalId}`;
}

/**
 * The last four characters, for "is this the one I pasted?".
 *
 * ⛔ Four, and only from the end. More would start to be useful to somebody who
 * had the rest, and the beginning of a token often encodes its type and app.
 */
export function tokenTail(plain: string): string {
  return plain.slice(-4);
}

/**
 * A fingerprint of the token, so a REPLACEMENT can be told from a RE-PASTE
 * without keeping the old value.
 *
 * 🔑 This is what makes "you changed your credentials, re-validate" possible
 * without storing anything comparable in plaintext: the same token hashes the
 * same, a different one does not, and the hash reveals nothing.
 */
export function tokenFingerprint(plain: string): string {
  return createHash("sha256").update(plain).digest("hex").slice(0, 16);
}
