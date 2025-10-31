"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Briefcase, Heart, Bot, User } from "lucide-react";
import clsx from "clsx";

const items = [
  { href: "/feel", label: "Feel", Icon: Home },
  { href: "/grow", label: "Grow", Icon: Briefcase },
  { href: "/connect", label: "Connect", Icon: Heart },
  { href: "/reflect", label: "Reflect", Icon: Bot },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-3 py-2">
        {items.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-md px-3 py-1 text-xs",
                  active ? "text-black" : "text-gray-500 hover:text-gray-800"
                )}
              >
                <Icon size={20} strokeWidth={1.75} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
