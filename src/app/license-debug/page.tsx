// src/app/license-debug/page.tsx
import { headers } from "next/headers";
import { blockIfProdNotAdmin } from "@/lib/prodGuard";
import LicenseDebugClient from "./LicenseDebugClient";

export default async function LicenseDebugPage() {
    const h = await headers();
    const req = new Request("http://localhost", { headers: h as any });
    const blocked = blockIfProdNotAdmin(req);
    if (blocked) return blocked as any;

    return <LicenseDebugClient />;
}
