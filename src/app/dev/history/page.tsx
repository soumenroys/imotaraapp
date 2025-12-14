// src/app/dev/history/page.tsx
import { headers } from "next/headers";
import { blockIfProdNotAdmin } from "@/lib/prodGuard";
import DevHistoryClient from "./DevHistoryClient";

export default async function DevHistoryPage() {
  const h = await headers();
  const req = new Request("http://localhost", { headers: h as any });
  const blocked = blockIfProdNotAdmin(req);
  if (blocked) return blocked as any;

  return <DevHistoryClient />;
}
