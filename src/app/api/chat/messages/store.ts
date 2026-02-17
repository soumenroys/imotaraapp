// src/app/api/chat/messages/store.ts
//
// Supabase-backed chat message store (scoped by user_scope header).
//
// Table: public.imotara_chat_messages
// Columns:
//  - id (text, PK)
//  - user_scope (text)
//  - thread_id (text)
//  - role (text)
//  - content (text)
//  - created_at (timestamptz)
//  - updated_at (timestamptz)
//  - meta (jsonb)

import { supabaseServer } from "@/lib/supabaseServer";

const TABLE = "imotara_chat_messages";

export type ChatMessageRole = "user" | "assistant" | "system";

export type ChatMessage = {
    id: string;
    user_scope: string;
    thread_id: string;
    role: ChatMessageRole;
    content: string;
    created_at: string; // ISO
    updated_at: string; // ISO
    meta?: any;
};

type DbRow = {
    id: string;
    user_scope: string;
    thread_id: string;
    role: string;
    content: string;
    created_at: string;
    updated_at: string;
    meta: any;
};

export async function getMessages(args: {
    user_scope: string;
    thread_id?: string;
    since_iso?: string;
    limit?: number;
}) {
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 2000);

    let q = supabaseServer
        .from(TABLE)
        .select("*")
        .eq("user_scope", args.user_scope)
        .order("created_at", { ascending: true })
        .limit(limit);

    if (args.thread_id) q = q.eq("thread_id", args.thread_id);
    if (args.since_iso) q = q.gte("created_at", args.since_iso);

    const { data, error } = await q;

    if (error) {
        console.error("[chat.messages] getMessages error:", error);
        return [];
    }

    return data ?? [];
}

export async function upsertMessages(rows: ChatMessage[]): Promise<void> {
    const cleaned = (rows ?? []).filter(
        (r) =>
            r &&
            typeof r.id === "string" &&
            r.id.trim() &&
            typeof r.user_scope === "string" &&
            r.user_scope.trim() &&
            typeof r.thread_id === "string" &&
            r.thread_id.trim() &&
            typeof r.role === "string" &&
            typeof r.content === "string"
    );

    if (cleaned.length === 0) return;

    const payload = cleaned.map((r) => ({
        id: r.id,
        user_scope: r.user_scope,
        thread_id: r.thread_id,
        role: r.role,
        content: r.content,
        created_at: r.created_at,
        updated_at: r.updated_at,
        meta: r.meta ?? {},
    }));

    const { error } = await supabaseServer.from(TABLE).upsert(payload, { onConflict: "id" });

    if (error) {
        // eslint-disable-next-line no-console
        console.error("upsertMessages supabase error:", error);
    }
}
