// src/app/dev/storage-check/page.tsx
import { headers } from "next/headers";
import { blockIfProdNotAdmin } from "@/lib/prodGuard";
import DevStorageCheckClient from "./DevStorageCheckClient";

export default async function DevStorageCheckPage() {
  const h = await headers();
  const req = new Request("http://localhost", { headers: h as any });
  const blocked = blockIfProdNotAdmin(req);
  if (blocked) return blocked as any;

  return <DevStorageCheckClient />;
}
