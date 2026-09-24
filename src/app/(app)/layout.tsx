import { LogOut } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { NAV, SELF_NAV } from "@/lib/nav";
import { getCachedSettings } from "@/lib/services/settings";
import { Sidebar } from "@/components/sidebar";
import { logoutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [ctx, settings] = await Promise.all([requirePage(), getCachedSettings()]);
  const items = [...NAV, ...SELF_NAV].filter((i) => can(ctx.role, i.perm));

  return (
    <div className="min-h-screen">
      <Sidebar items={items} orgName={settings.orgName} />
      <div className="lg:pl-60">
        <header className="no-print flex items-center justify-end gap-3 border-b bg-card px-4 py-2 text-sm">
          <span className="font-medium">{ctx.name}</span>
          <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium">{ctx.role}</span>
          <form action={logoutAction}>
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-accent"
              type="submit"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
