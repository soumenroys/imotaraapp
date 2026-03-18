// src/app/api/memory/route.ts
// GET  → list current user's memories
// DELETE ?id=<id> → delete a single memory by id

import { NextRequest, NextResponse } from "next/server";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";

export async function GET() {
    try {
        const supabase = await supabaseUserServer();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const memories = await fetchUserMemories(supabase, user.id, 50);
        return NextResponse.json({ memories });
    } catch {
        return NextResponse.json({ memories: [] });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        const supabase = await supabaseUserServer();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { error } = await supabase
            .from("user_memory")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
