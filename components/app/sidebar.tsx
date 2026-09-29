"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, FilePlus2, Palette, Users, Layers, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLogo } from "./logo";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Admit Cards", icon: FilePlus2 },
  { href: "/templates", label: "Templates & Branding", icon: Palette },
  { href: "/candidates", label: "Candidate Records", icon: Users },
  { href: "/batches", label: "Generated Batches", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ orgName, userName, children }: { orgName: string; userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => {
    if (href === "/") return pathname === "/";
    if (pathname.endsWith("/setup")) return href === "/create";
    return pathname.startsWith(href);
  };

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
            active(href) ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const footer = (
    <div className="mt-auto border-t border-white/10 pt-4">
      <div className="px-3 text-xs text-white/50">Signed in as</div>
      <div className="truncate px-3 text-sm font-semibold text-white">{userName}</div>
      <div className="truncate px-3 text-xs text-white/60">{orgName}</div>
      <button onClick={logout} className="mt-3 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/8 hover:text-white">
        <LogOut className="size-[18px]" aria-hidden /> Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-primary px-3 py-5 lg:flex">
        <div className="px-2 text-white [&_.text-muted-foreground]:text-white/60">
          <AppLogo />
        </div>
        {nav}
        {footer}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col gap-6 bg-primary px-3 py-5">
            <div className="flex items-center justify-between px-2 text-white [&_.text-muted-foreground]:text-white/60">
              <AppLogo />
              <button className="cursor-pointer rounded p-1 text-white" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
          <button className="cursor-pointer rounded p-1.5 hover:bg-muted" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <AppLogo />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
