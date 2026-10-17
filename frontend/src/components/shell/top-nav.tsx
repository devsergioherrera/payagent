"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LINKS = [
  { href: "/", label: "Mesa" },
  { href: "/facturas", label: "Facturas" },
  { href: "/reglas", label: "Reglas" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/costos", label: "Costos" },
];

export function BrandMark({ className, collapsible }: { className?: string; collapsible?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold leading-none text-primary-foreground">
        F<span className="text-brand">y</span>
      </span>
      <span className={cn(collapsible && "hidden sm:inline")}>FacturaYa</span>
    </span>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="shrink-0"><BrandMark collapsible /></Link>
        <nav className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto sm:justify-center">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                isActive(l.href) && "bg-secondary font-medium text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Avatar className="size-8"><AvatarFallback className="bg-primary text-xs text-primary-foreground">S</AvatarFallback></Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={async () => { await api.logout(); router.push("/login"); }}>
              <LogOut /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
