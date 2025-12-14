// src/app/dev/seed/page.tsx
import { headers } from "next/headers";
import { blockIfProdNotAdmin } from "@/lib/prodGuard";
import DevSeedClient from "./DevSeedClient";

export default async function DevSeedPage() {
  const h = await headers();
  const req = new Request("http://localhost", { headers: h as any });
  const blocked = blockIfProdNotAdmin(req);
  if (blocked) return blocked as any;

  return <DevSeedClient />;
}
