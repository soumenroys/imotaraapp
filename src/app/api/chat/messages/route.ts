// src/app/api/chat/messages/route.ts
import { NextResponse } from "next/server";
import { getMessages, upsertMessages, type ChatMessageRole } from "./store";

const USER_SCOPE_HEADER = "x-imotara-user";

function sanitizeScope(raw: string | null): string {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function getScopeFromRequest(req: Request): string {
    return sanitizeScope(req.headers.get(USER_SCOPE_HEADER));
}

function coerceRole(v: any): ChatMessageRole {
    const s = String(v ?? "").toLowerCase().trim();
    if (s === "assistant" || s === "system") return s;
    return "user";
}

function coerceMessage(input: any, user_scope: string) {
    if (!input || typeof input !== "object") return null;

    // id
    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) return null;

    // thread id (support snake_case + camelCase)
    const rawThread =
        typeof input.thread_id === "string"
            ? input.thread_id
            : typeof input.threadId === "string"
                ? input.threadId
                : "";
    const thread_id = String(rawThread ?? "").trim();

    // content (support content + text)
    const rawContent =
        typeof input.content === "string"
            ? input.content
            : typeof input.text === "string"
                ? input.text
                : "";
    const content = String(rawContent ?? "");

    if (!thread_id || !content.trim()) return null;

    const role = coerceRole(input.role);

    const nowIso = new Date().toISOString();

    // created_at (support ISO string + ms number + ISO in createdAt)
    const created_at = (() => {
        if (typeof input.created_at === "string" && input.created_at.trim()) {
            return input.created_at;
        }
        if (typeof input.createdAt === "number" && Number.isFinite(input.createdAt)) {
            return new Date(input.createdAt).toISOString();
        }
        if (typeof input.createdAt === "string" && input.createdAt.trim()) {
            // assume ISO-ish string
            return input.createdAt;
        }
        return nowIso;
    })();

    // updated_at (support ISO string + ms number + ISO in updatedAt)
    const updated_at = (() => {
        if (typeof input.updated_at === "string" && input.updated_at.trim()) {
            return input.updated_at;
        }
        if (typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)) {
            return new Date(input.updatedAt).toISOString();
        }
        if (typeof input.updatedAt === "string" && input.updatedAt.trim()) {
            return input.updatedAt;
        }
        return created_at;
    })();

    return {
        id,
        user_scope,
        thread_id,
        role,
        content,
        created_at,
        updated_at,
        meta: input.meta ?? {},
    };
}


function coerceFromBody(body: any, user_scope: string) {
    // preferred: { messages: [...] }
    if (body && typeof body === "object" && Array.isArray(body.messages)) {
        return body.messages
            .map((m: any) => coerceMessage(m, user_scope))
            .filter(Boolean) as any[];
    }

    // compat: array
    if (Array.isArray(body)) {
        return body
            .map((m: any) => coerceMessage(m, user_scope))
            .filter(Boolean) as any[];
    }

    // compat: single object
    const one = coerceMessage(body, user_scope);
    return one ? [one] : [];
}

// GET /api/chat/messages?threadId=...&limit=...&since=ISO
export async function GET(request: Request) {
    const scope = getScopeFromRequest(request);

    // 🔒 safety: never allow unscoped reads (prevents “global shared chat”)
    if (!scope) {
        return NextResponse.json({ messages: [], serverTs: Date.now() }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const threadId = (searchParams.get("threadId") ?? "").trim();
    const since = (searchParams.get("since") ?? "").trim();
    const limit = Number(searchParams.get("limit") ?? "500");

    const messages = await getMessages({
        user_scope: scope,
        thread_id: threadId || undefined,
        since_iso: since || undefined,
        limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 2000) : 500,
    });

    return NextResponse.json({ messages, serverTs: Date.now() }, { status: 200 });
}

// POST /api/chat/messages
// body: { messages: [...] } OR [ ... ] OR single message
export async function POST(request: Request) {
    try {
        const scope = getScopeFromRequest(request);

        // 🔒 safety: never allow unscoped writes
        if (!scope) {
            return NextResponse.json(
                { ok: false, acceptedIds: [], serverTs: Date.now() },
                { status: 400 }
            );
        }

        const body = await request.json();
        const rows = coerceFromBody(body, scope);

        await upsertMessages(rows as any);

        return NextResponse.json(
            { ok: true, acceptedIds: rows.map((r: any) => r.id), serverTs: Date.now() },
            { status: 200 }
        );
    } catch (err) {
        const PROD = process.env.NODE_ENV === "production";
        const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";
        if (SHOULD_LOG) {
            // eslint-disable-next-line no-console
            console.warn("POST /api/chat/messages error:", String(err));
        }

        return NextResponse.json(
            { ok: false, acceptedIds: [], serverTs: Date.now() },
            { status: 400 }
        );
    }
}
