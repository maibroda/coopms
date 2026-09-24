"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <nav className="space-y-1 pb-8">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={onNavigate}
          className={cn(
            "block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white",
            isActive(i.href) && "bg-white/15 font-medium text-white",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar({ items, orgName }: { items: NavItem[]; orgName: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <button
        className="no-print fixed left-3 top-3 z-40 rounded-md bg-slate-900 p-2 text-white lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-slate-900 px-3 py-4 lg:flex">
        <div className="mb-4 flex items-center gap-2 px-2 text-white">
          <Landmark className="h-5 w-5" />
          <span className="text-sm font-semibold leading-tight">{orgName}</span>
        </div>
        <NavList items={items} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-slate-900 px-3 py-4">
            <div className="mb-4 flex items-center justify-between px-2 text-white">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="h-5 w-5" /> {orgName}
              </span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList items={items} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
