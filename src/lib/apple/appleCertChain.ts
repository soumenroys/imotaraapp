// src/lib/apple/appleCertChain.ts
// Does the certificate inside Apple's signed answer really come from Apple?
//
// 🔴 #80 (8 Nov 2026): verifyAppleJWS checked the signature with the key in the
// answer's OWN leaf certificate (x5c[0]) and stopped there. Anyone can make a
// certificate, sign a payload with it, and put it in x5c — so that check proves
// "this payload matches this certificate", never "Apple sent it". Harmless while
// we only FETCH answers from Apple over HTTPS; a real hole the day Apple PUSHES
// App Store Server Notifications to us. ⇒ the chain must end at Apple's root.
//
// What is checked, in Apple's own order (app-store-server-library):
//   1. every certificate is inside its validity window;
//   2. each one is issued AND signed by the next one up;
//   3. the top one is EXACTLY Apple Root CA - G3 (pinned below — fetched from
//      apple.com/certificateauthority on 8 Nov 2026, SHA-256 fingerprint
//      63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79);
//   4. the intermediate carries Apple's WWDR marker OID 1.2.840.113635.100.6.2.1
//      and the leaf Apple's receipt-signing OID 1.2.840.113635.100.6.11.1.
// ⛔ Never fetches anything — the root is pinned, not looked up.

import { X509Certificate } from "crypto";

export const APPLE_ROOT_CA_G3_DER_B64 =
    "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

export const APPLE_ROOT_CA_G3_SHA256 =
    "63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79";

const OID_WWDR_INTERMEDIATE = "1.2.840.113635.100.6.2.1";
const OID_RECEIPT_SIGNING_LEAF = "1.2.840.113635.100.6.11.1";

/** DER bytes of an OBJECT IDENTIFIER (tag 06, length, value). */
function oidDer(oid: string): Buffer {
    const parts = oid.split(".").map(Number);
    const bytes: number[] = [40 * parts[0] + parts[1]];
    for (const n of parts.slice(2)) {
        const stack: number[] = [n & 0x7f];
        let v = n >>> 7;
        while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v >>>= 7; }
        bytes.push(...stack);
    }
    return Buffer.from([0x06, bytes.length, ...bytes]);
}

function hasOid(cert: X509Certificate, oid: string): boolean {
    return cert.raw.includes(oidDer(oid));
}

export type ChainResult = { ok: true } | { ok: false; reason: string };

export function verifyAppleCertChain(
    x5c: unknown,
    opts: { now?: Date; rootDerB64?: string } = {},
): ChainResult {
    try {
        if (!Array.isArray(x5c) || x5c.length < 3) return { ok: false, reason: "x5c must hold leaf, intermediate and root" };
        const certs = x5c.map((b64) => new X509Certificate(Buffer.from(String(b64), "base64")));
        const now = (opts.now ?? new Date()).getTime();

        for (const c of certs) {
            if (now < Date.parse(c.validFrom) || now > Date.parse(c.validTo)) {
                return { ok: false, reason: `certificate outside its validity window: ${c.subject.split("\n").join(", ")}` };
            }
        }
        for (let i = 0; i < certs.length - 1; i++) {
            if (!certs[i].checkIssued(certs[i + 1]) || !certs[i].verify(certs[i + 1].publicKey)) {
                return { ok: false, reason: `certificate ${i} is not issued and signed by certificate ${i + 1}` };
            }
        }
        const pinned = new X509Certificate(Buffer.from(opts.rootDerB64 ?? APPLE_ROOT_CA_G3_DER_B64, "base64"));
        const top = certs[certs.length - 1];
        if (!top.raw.equals(pinned.raw)) return { ok: false, reason: "chain does not end at the pinned Apple root" };
        if (!top.verify(pinned.publicKey)) return { ok: false, reason: "root is not self-signed by the pinned key" };

        if (!hasOid(certs[1], OID_WWDR_INTERMEDIATE)) return { ok: false, reason: "intermediate lacks Apple's WWDR marker OID" };
        if (!hasOid(certs[0], OID_RECEIPT_SIGNING_LEAF)) return { ok: false, reason: "leaf lacks Apple's receipt-signing OID" };
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: `unreadable certificate chain: ${(e as Error).message}` };
    }
}
