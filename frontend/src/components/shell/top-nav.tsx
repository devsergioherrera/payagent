"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleDollarSign, House, LogOut, ReceiptText, Scale, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Notifications } from "./notifications";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LINKS = [
  { href: "/", label: "Mesa", icon: House },
  { href: "/facturas", label: "Facturas", icon: ReceiptText },
  { href: "/reglas", label: "Reglas", icon: Scale },
  { href: "/proveedores", label: "Directorio", icon: Building2 },
  { href: "/costos", label: "Costos", icon: CircleDollarSign },
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
        <nav className="flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-label={l.label}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-[color,background-color,transform] hover:text-foreground active:scale-[0.98] sm:px-3",
                isActive(l.href) && "bg-secondary font-medium text-foreground",
              )}
            >
              <l.icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{l.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <Notifications />
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
      </div>
    </header>
  );
}
