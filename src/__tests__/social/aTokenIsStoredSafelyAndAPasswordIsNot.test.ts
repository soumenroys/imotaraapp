/**
 * 🔐 WHAT MAY BE STORED FOR A CHANNEL, AND WHAT MAY NOT.
 *
 * 🔑 THE QUESTION THIS FILE ANSWERS, because it is a reasonable one and it
 * will be asked again. The owner asked, on 18 Oct: why not encrypt my social
 * password and store it, so the app can log in as me?
 *
 *   • A HASH cannot do it. It is one-way — checkable, never usable to log in.
 *   • ENCRYPTION can, and that is exactly the problem: logging in needs the
 *     plaintext back, so the key must sit in the same environment as the
 *     ciphertext. Anyone with both has the password. There is no arrangement
 *     of reversible cryptography that avoids this.
 *   • And it would not work anyway: no platform here allows programmatic
 *     password login, and driving a browser instead meets checkpoints, 2FA and
 *     terms that cost accounts.
 *
 * ⇒ A TOKEN is better at the very thing that was wanted. It is scoped to
 * posting on one page, revocable on its own, and ⛔ it SURVIVES A PASSWORD
 * CHANGE — so changing a Facebook password does not break posting, where a
 * stored password would break it every time.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  encryptToken,
  decryptToken,
  tokenAad,
  tokenTail,
  tokenFingerprint,
  tokenStorageReady,
} from "@/lib/social/tokenCrypto";

const KEY = Buffer.alloc(32, 7).toString("base64");
let previous: string | undefined;

beforeEach(() => {
  previous = process.env.SOCIAL_TOKEN_KEY;
  process.env.SOCIAL_TOKEN_KEY = KEY;
});
afterEach(() => {
  if (previous === undefined) delete process.env.SOCIAL_TOKEN_KEY;
  else process.env.SOCIAL_TOKEN_KEY = previous;
});

describe("the token round-trips", () => {
  it("comes back exactly as it went in", () => {
    const token = "EAAB" + "x".repeat(180);
    const aad = tokenAad("facebook", "1234567890");
    expect(decryptToken(encryptToken(token, aad), aad)).toBe(token);
  });

  it("is different every time, for the same token", () => {
    // ⚠️ A random IV per encryption. Identical ciphertext for identical input
    // would leak that two accounts share a token.
    const aad = tokenAad("facebook", "1");
    const a = encryptToken("a-token-value-that-is-long-enough", aad);
    const b = encryptToken("a-token-value-that-is-long-enough", aad);
    expect(a).not.toBe(b);
    expect(decryptToken(a, aad)).toBe(decryptToken(b, aad));
  });

  it("⛔ refuses to decrypt under a different binding", () => {
    /**
     * 🔑 WHAT THE AAD IS FOR, and it is not decoration. Without it, one row's
     * ciphertext decrypts perfectly in another — so a write that swapped two
     * rows would post to the wrong channel with the wrong credential, and
     * nothing anywhere would error.
     */
    const sealed = encryptToken("a-token-value-that-is-long-enough", tokenAad("facebook", "111"));
    expect(() => decryptToken(sealed, tokenAad("facebook", "222"))).toThrow();
    expect(() => decryptToken(sealed, tokenAad("linkedin", "111"))).toThrow();
  });

  it("⛔ refuses tampered ciphertext rather than returning something", () => {
    const aad = tokenAad("facebook", "1");
    const sealed = encryptToken("a-token-value-that-is-long-enough", aad);
    const parts = sealed.split(".");
    const flipped = Buffer.from(parts[3], "base64");
    flipped[0] ^= 0xff;
    parts[3] = flipped.toString("base64");
    // The GCM tag failing IS the authentication. It must never be caught.
    expect(() => decryptToken(parts.join("."), aad)).toThrow();
  });

  it("⛔ refuses a payload it does not recognise, rather than trying it as plaintext", () => {
    // A value that fails to parse is a bug or a tamper. Using it anyway would
    // mean sending an unknown string to a platform as a credential.
    expect(() => decryptToken("EAABsomethingraw", tokenAad("facebook", "1"))).toThrow(/not a v1 payload/i);
    expect(() => decryptToken("", tokenAad("facebook", "1"))).toThrow();
  });
});

describe("without a key, nothing is stored", () => {
  it("⛔ refuses rather than writing plaintext", () => {
    delete process.env.SOCIAL_TOKEN_KEY;
    expect(tokenStorageReady().ok).toBe(false);
    expect(() => encryptToken("a-token-value-that-is-long-enough", "x")).toThrow(/not set/i);
  });

  it("refuses a key of the wrong length, loudly", () => {
    // ⚠️ A short key is not a weaker key here — it is a crash at the moment a
    // post would publish, so it has to fail at connect time instead.
    process.env.SOCIAL_TOKEN_KEY = Buffer.alloc(16, 1).toString("base64");
    const ready = tokenStorageReady();
    expect(ready.ok).toBe(false);
    expect(ready.reason).toMatch(/32/);
  });

  it("says so in a sentence somebody can act on", () => {
    delete process.env.SOCIAL_TOKEN_KEY;
    expect(tokenStorageReady().reason).toMatch(/SOCIAL_TOKEN_KEY/);
    expect(tokenStorageReady().reason).toMatch(/32 random bytes/i);
  });
});

describe("what is shown back, and what is not", () => {
  it("only the last four characters", () => {
    const token = "EAABwxyzSECRETMIDDLEPART1234abcd";
    expect(tokenTail(token)).toBe("abcd");
    // ⛔ The BEGINNING of a token often encodes its type and app, so it is
    // never the part shown.
    expect(tokenTail(token)).not.toContain("EAAB");
    expect(tokenTail(token).length).toBe(4);
  });

  it("the fingerprint tells a replacement from a re-paste, and reveals nothing", () => {
    const a = tokenFingerprint("a-token-value-that-is-long-enough");
    const b = tokenFingerprint("a-token-value-that-is-long-enough");
    const c = tokenFingerprint("a-DIFFERENT-token-value-entirely!");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toContain("token");
  });
});

describe("⛔ the connect route never takes a password", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/social/channels/route.ts"),
    "utf8",
  );
  /** Comments stripped: this route explains the reasoning in prose that names
   *  the very words being banned ⇒ the same trap hit three times before. */
  const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("accepts no field that could be one", () => {
    for (const field of ["password", "passphrase", "pin", "username", "email"]) {
      expect(code.toLowerCase(), `the connect route reads a "${field}"`).not.toMatch(
        new RegExp(`input\\.${field}`, "i"),
      );
    }
  });

  it("rejects something that looks like an email or is far too short", () => {
    // ⚠️ Not a security control — somebody determined could paste anything.
    // It is a GUARDRAIL against the honest mistake of pasting the wrong thing
    // into a field labelled for a token.
    expect(code).toMatch(/does not look like a platform token/i);
  });

  it("refuses to store at all when there is no key", () => {
    expect(code).toMatch(/tokenStorageReady/);
    expect(code).toMatch(/503/);
  });

  it("stores encrypted, never raw", () => {
    expect(code).toMatch(/access_token: encryptToken\(/);
    expect(code, "a raw token is assigned somewhere").not.toMatch(/access_token:\s*accessToken/);
  });

  it("marks a newly stored token PENDING, not working", () => {
    // 🔑 Being saved is not being shown to work, and the difference is the
    // whole point of the health check.
    expect(code).toMatch(/status:\s*"pending"/);
  });
});
