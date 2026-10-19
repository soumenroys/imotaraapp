import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: "/Users/soumenroy/Projects/imotaraapp/.env.local" });
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  for (let i = 0; i < 40; i += 1) {
    const { data } = await db.from("social_post_stats").select("post_id, captured_on, reach, impressions, reactions, saves");
    const today = (data ?? []).filter((r: any) => String(r.captured_on) >= "2026-10-19");
    if (today.length > 0) {
      console.log(`STATS LANDED: ${today.length} rows captured today, ${data?.length} total`);
      for (const r of today as any[])
        console.log(`  post=${String(r.post_id).slice(0,8)} reach=${r.reach ?? "-"} impr=${r.impressions ?? "-"} reactions=${r.reactions} saves=${r.saves ?? "-"}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
  console.log("NO STATS after 20 minutes — the 14:00Z run did not capture anything.");
}
main().catch((e) => { console.error("WATCHER FAILED:", e.message); process.exit(1); });
