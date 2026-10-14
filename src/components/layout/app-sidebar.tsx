import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ChevronRight,
  FileText,
  HandCoins,
  History,
  LayoutDashboard,
  LogOut,
  Repeat,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { canAccess, useCurrentUser, type Role } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  children?: { title: string; url: string }[];
};

const workspace: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  {
    title: "Inventory",
    url: "/inventory",
    icon: Boxes,
    children: [
      { title: "Equipment", url: "/inventory" },
      { title: "Rental Logs", url: "/inventory/rental-logs" },
      { title: "Sales Logs", url: "/inventory/sales-logs" },
    ],
  },
  { title: "Rentals", url: "/rentals", icon: Repeat },
  { title: "Sales", url: "/sales", icon: HandCoins },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Payments", url: "/payments", icon: Wallet },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const admin: NavItem[] = [
  { title: "Users & Roles", url: "/users", icon: ShieldCheck },
  { title: "Activity Log", url: "/activity", icon: History },
];

const account: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Profile", url: "/profile", icon: UserRound },
];

/** Keeps items (and sub-items) the preview role can open. */
function visibleItems(items: NavItem[], role: Role): NavItem[] {
  return items.flatMap((item) => {
    if (!item.children) return canAccess(role, item.url) ? [item] : [];
    const children = item.children.filter((c) => canAccess(role, c.url));
    return children.length ? [{ ...item, children }] : [];
  });
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { role } = useCurrentUser();

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");
  // Sub-items: exact match, so "Equipment" isn't active on /inventory/rental-logs.
  const isSubActive = (url: string) =>
    url === "/inventory"
      ? pathname === "/inventory" ||
        (/^\/inventory\/[^/]+$/.test(pathname) && !pathname.endsWith("-logs"))
      : isActive(url);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const groups = [
    { label: "Workspace", items: visibleItems(workspace, role) },
    { label: "Administration", items: visibleItems(admin, role) },
    { label: "Account", items: visibleItems(account, role) },
  ].filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <BrandLogo className="size-9 shrink-0 rounded-lg" />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">
                Breath Care Kart
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Rental Operations
              </span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) =>
                  item.children ? (
                    <Collapsible
                      key={item.title}
                      asChild
                      defaultOpen={isActive(item.url)}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        {collapsed ? (
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.url)}
                            tooltip={item.title}
                          >
                            <Link to={item.children[0]!.url} className="flex items-center gap-2.5">
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        ) : (
                          <>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton isActive={isActive(item.url)} tooltip={item.title}>
                                <item.icon className="size-4" />
                                <span>{item.title}</span>
                                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.children.map((child) => (
                                  <SidebarMenuSubItem key={child.url}>
                                    <SidebarMenuSubButton asChild isActive={isSubActive(child.url)}>
                                      <Link to={child.url}>{child.title}</Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2.5">
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              onClick={handleLogout}
              className="text-muted-foreground"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
