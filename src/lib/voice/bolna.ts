// src/lib/voice/bolna.ts
// Placing a call through Bolna, and reading one back.
//
// ⚠️ The response and webhook shapes are taken from the voice spec and read
// defensively: the first real test call is what confirms them, and a parser
// that hunts for its field survives a shape that moved one level over.
//
// ⛔ BOLNA_API_KEY lives only in Vercel and is never logged.

const BASE = (process.env.BOLNA_API_BASE?.trim() || "https://api.bolna.ai").replace(/\/$/, "");

export const DEFAULT_FROM_NUMBER = "+918064261865";

export function bolnaConfigured(): boolean {
  return Boolean(process.env.BOLNA_API_KEY?.trim());
}

function headers() {
  const key = process.env.BOLNA_API_KEY?.trim();
  if (!key) throw new Error("BOLNA_API_KEY is not set.");
  return { authorization: `Bearer ${key}`, "content-type": "application/json" };
}

export type Placed = { ok: true; executionId: string } | { ok: false; error: string };

export async function placeCall(agentId: string, phone: string, userData: Record<string, string>): Promise<Placed> {
  try {
    const res = await fetch(`${BASE}/call`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: phone,
        from_phone_number: process.env.VOICE_FROM_NUMBER?.trim() || DEFAULT_FROM_NUMBER,
        user_data: userData,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Bolna answered ${res.status}: ${text.slice(0, 300)}` };
    const body = JSON.parse(text || "{}") as Record<string, unknown>;
    const id = String(body.execution_id ?? body.call_id ?? body.id ?? "");
    return id ? { ok: true, executionId: id } : { ok: false, error: `Bolna gave no execution id: ${text.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: `Bolna could not be reached (${(e as Error).message}).` };
  }
}

export async function getExecution(executionId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE}/executions/${encodeURIComponent(executionId)}`, { headers: headers(), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Find a field anywhere in a nested object — Bolna's nesting is the part most likely to move. */
function find(o: unknown, keys: string[], depth = 0): unknown {
  if (!o || typeof o !== "object" || depth > 5) return undefined;
  const rec = o as Record<string, unknown>;
  for (const k of keys) if (rec[k] !== undefined && rec[k] !== null && rec[k] !== "") return rec[k];
  for (const v of Object.values(rec)) {
    const hit = find(v, keys, depth + 1);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export type ExecutionView = {
  executionId: string;
  status: string;
  final: boolean;
  extraction: Record<string, string>;
  summary: string;
  tab: string;
  phone: string;
};

/** ⚠️ Only "completed" is final; "call-disconnected" is NOT ⇒ spec §7.3. */
export const FINAL_STATUSES = new Set(["completed", "no-answer", "busy", "failed", "canceled", "cancelled"]);

export function readExecution(body: Record<string, unknown>): ExecutionView {
  const status = String(find(body, ["status"]) ?? "").toLowerCase();
  const rawExtraction = find(body, ["extracted_data", "extractions", "custom_extractions"]);
  const extraction: Record<string, string> = {};
  if (rawExtraction && typeof rawExtraction === "object") {
    for (const [k, v] of Object.entries(rawExtraction as Record<string, unknown>)) {
      extraction[k] = typeof v === "object" && v !== null ? String((v as Record<string, unknown>).value ?? JSON.stringify(v)) : String(v ?? "");
    }
  }
  return {
    executionId: String(find(body, ["execution_id", "id"]) ?? ""),
    status,
    final: FINAL_STATUSES.has(status),
    extraction,
    summary: String(find(body, ["summary"]) ?? extraction.summary ?? ""),
    tab: String(find(body, ["imotara_tab"]) ?? ""),
    phone: String(find(body, ["imotara_phone"]) ?? ""),
  };
}
