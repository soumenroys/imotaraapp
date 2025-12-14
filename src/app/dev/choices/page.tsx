// src/app/dev/choices/page.tsx
import { headers } from "next/headers";
import { blockIfProdNotAdmin } from "@/lib/prodGuard";
import DevChoicesClient from "./DevChoicesClient";

export default async function DevChoicesPage() {
  const h = await headers();
  const req = new Request("http://localhost", { headers: h as any });
  const blocked = blockIfProdNotAdmin(req);
  if (blocked) return blocked as any;

  return <DevChoicesClient />;
}
