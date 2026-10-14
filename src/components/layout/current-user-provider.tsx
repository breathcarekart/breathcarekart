import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Clock, LogOut } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ErrorState } from "@/components/shared/error-state";
import { FullPageLoader } from "@/components/shared/loaders";
import { Button } from "@/components/ui/button";
import { profileQueries } from "@/lib/db/profiles";
import { CurrentUserContext, toRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

/**
 * Loads the signed-in user's profile and role for the app shell.
 * Accounts without an active profile see a holding screen instead of the app
 * (the database already gives them no data).
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const query = useQuery(profileQueries.current());
  const profile = query.data;

  const value = useMemo(
    () =>
      profile && profile.is_active
        ? {
            profile,
            role: toRole(profile.role),
            name: profile.full_name || profile.email || "Team member",
          }
        : null,
    [profile],
  );

  if (query.isPending) return <FullPageLoader />;
  if (query.isError) {
    return (
      <Shell>
        <ErrorState
          error={query.error}
          title="Couldn't load your account"
          onRetry={() => void query.refetch()}
        />
      </Shell>
    );
  }
  if (!value) return <PendingActivation email={profile?.email ?? null} />;

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function PendingActivation({ email }: { email: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center shadow-soft">
        <BrandLogo className="size-12 rounded-xl" />
        <span className="flex size-10 items-center justify-center rounded-xl bg-warning-soft text-warning-foreground">
          <Clock className="size-5" />
        </span>
        <h1 className="text-lg font-semibold">Account awaiting activation</h1>
        <p className="text-sm text-muted-foreground">
          {email ? `${email} is signed in, but` : "You're signed in, but"} an admin still needs to
          activate your account and assign your role.
        </p>
        <Button
          variant="outline"
          className="mt-2 rounded-xl"
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </Shell>
  );
}
