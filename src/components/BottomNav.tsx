"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Recettes", icon: "📖" },
  { href: "/ajouter", label: "Ajouter", icon: "➕" },
  { href: "/famille", label: "Famille", icon: "👨‍👩‍👧" },
];

export function BottomNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/recettes") : path.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-trait bg-papier/95 pb-[env(safe-area-inset-bottom)] backdrop-blur
      md:inset-x-auto md:right-6 md:bottom-6 md:rounded-2xl md:border md:pb-0 md:shadow-lg">
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map((it) => (
          <li key={it.href} className="flex-1">
            <Link href={it.href}
              className={`flex flex-col items-center gap-0.5 px-5 py-2.5 text-xs font-medium ${active(it.href) ? "text-tomate" : "text-encre-douce"}`}>
              <span className="text-xl leading-none" aria-hidden>{it.icon}</span>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
