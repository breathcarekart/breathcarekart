import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FullPageLoader } from "@/components/shared/loaders";
import { requireSession } from "@/lib/auth";
import { CurrentUserProvider } from "@/components/layout/current-user-provider";
import { canAccess, roleLabel, useCurrentUser } from "@/lib/roles";

export const Route = createFileRoute("/_app")({
  // The session lives in browser storage, so the guard (and every protected page
  // below it) runs only in the browser. The server sends no protected content.
  ssr: false,
  beforeLoad: ({ location }) => requireSession(location),
  pendingComponent: FullPageLoader,
  component: AppLayout,
});

function AppLayout() {
  return (
    <CurrentUserProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
              <div className="page-enter mx-auto w-full max-w-[1400px]">
                <RoleGate />
              </div>
            </main>
          </div>
        </div>
        <Toaster position="top-right" richColors />
      </SidebarProvider>
    </CurrentUserProvider>
  );
}

/** Keeps each role in its workspace. Data access itself is enforced by the database (RLS). */
function RoleGate() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { role } = useCurrentUser();

  if (canAccess(role, pathname)) return <Outlet />;

  return (
    <EmptyState
      icon={Lock}
      title={`Not available for the ${roleLabel(role)} role`}
      description="This screen is outside your role's workspace. Ask an admin if you need access."
      action={
        <Button asChild className="mt-2 rounded-xl">
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      }
    />
  );
}
