"use client";
// #108 (owner 22 Nov 2026): renders its children only when "Show Connect" is switched on
// (Settings → Appearance). OFF by default — so server-rendered pages (the footer) can keep a
// Connect link without showing it to people who haven't asked for Connect.
import { useEffect, useState, type ReactNode } from "react";
import { readShowConnect, SHOW_CONNECT_EVENT, SHOW_CONNECT_KEY } from "@/lib/imotara/connectVisibility";

export default function ShowWhenConnectOn({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readShowConnect());
    const onChange = () => setOn(readShowConnect());
    const onStorage = (e: StorageEvent) => { if (e.key === SHOW_CONNECT_KEY) onChange(); };
    window.addEventListener(SHOW_CONNECT_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SHOW_CONNECT_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return on ? <>{children}</> : null;
}
