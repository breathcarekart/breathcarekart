import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { RoleBadge } from "@/components/shared/badges";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { initials as toInitials } from "@/lib/format";
import { canAccess, roleLabel, useCurrentUser } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

const titles: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  customers: "Customers",
  invoices: "Invoices",
  rentals: "Rentals",
  reports: "Reports",
  settings: "Settings",
  profile: "Profile",
  new: "New",
  "rental-logs": "Rental Logs",
  "sales-logs": "Sales Logs",
  sales: "Sales",
  payments: "Payments",
  users: "Users & Roles",
  activity: "Activity Log",
  deliveries: "Deliveries",
};

function useThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function Topbar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { dark, toggle } = useThemeToggle();
  const segments = pathname.split("/").filter(Boolean);
  const { role, name } = useCurrentUser();
  const initials = toInitials(name);

  return (
    <header className="glass-panel sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-x-0 border-t-0 px-4 lg:px-6">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator orientation="vertical" className="hidden h-6 sm:block" />

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {segments.map((seg, i) => (
            <span key={seg + i} className="flex items-center gap-1.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {i === segments.length - 1 ? (
                  <BreadcrumbPage>{titles[seg] ?? seg.toUpperCase()}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={"/" + segments.slice(0, i + 1).join("/")}>{titles[seg] ?? seg}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search equipment, customers, invoices…"
            className="h-9 w-64 rounded-xl bg-background pl-9 lg:w-80"
          />
        </div>

        <Button variant="ghost" size="icon" className="rounded-xl md:hidden" aria-label="Search">
          <Search className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <NotificationsMenu />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-sm font-medium">{name}</span>
                <span className="block text-xs text-muted-foreground">{roleLabel(role)}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              <span className="truncate">{name}</span>
              <RoleBadge role={role} />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
              Profile
            </DropdownMenuItem>
            {canAccess(role, "/settings") && (
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
