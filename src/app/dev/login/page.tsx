// src/app/dev/login/page.tsx
import { notFound } from "next/navigation";
import DevLoginClient from "./DevLoginClient";

export default function DevLoginPage() {
    // ✅ Real gate: evaluated on server/build, not in a client bundle
    if (process.env.NODE_ENV === "production") notFound();

    return <DevLoginClient />;
}
