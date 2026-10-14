import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { RoleBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddStaffDialog } from "@/components/users/add-staff-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { profileQueries, updateProfile } from "@/lib/db/profiles";
import { queryKeys } from "@/lib/db/query-keys";
import type { Profile } from "@/lib/db/types";
import { formatDate, initials } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { roleLabel, roleSummaries, roles, toRole, useCurrentUser, type Role } from "@/lib/roles";

export const Route = createFileRoute("/_app/users")({
  head: () => ({
    meta: [
      { title: "Users & Roles · Breath Care Kart" },
      {
        name: "description",
        content: "Staff accounts and their roles: Admin, Telecaller and Supervisor.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const queryClient = useQueryClient();
  const { profile: me } = useCurrentUser();
  const query = useQuery(profileQueries.list());
  const [adding, setAdding] = useState(false);

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: Role; is_active?: boolean } }) =>
      updateProfile(id, patch),
    onSuccess: async (p) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });
      notifySuccess(
        "User updated",
        `${p.full_name ?? p.email} · ${roleLabel(toRole(p.role))}${p.is_active ? "" : " · inactive"}`,
      );
    },
    onError: (error) => notifyError(error, "Couldn't update user"),
  });

  const users = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Who can sign in, and what each role can do."
        actions={
          <Button className="rounded-xl" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add user
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((r) => (
          <Card key={r} className="gap-2 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <RoleBadge role={r} />
              <span className="text-xs text-muted-foreground">
                {users.filter((u) => toRole(u.role) === r && u.is_active).length} active
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{roleSummaries[r]}</p>
          </Card>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <div className="px-5 py-4">
          <h2 className="text-base font-semibold">Staff accounts</h2>
          <p className="text-sm text-muted-foreground">
            Accounts you add here use the role you choose. Anyone who signs up on their own appears
            as inactive until you activate them.
          </p>
        </div>
        <Separator />
        <QueryState query={query} errorTitle="Couldn't load users">
          {(list) => (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isMe={u.id === me.id}
                    busy={update.isPending}
                    onChange={(patch) => update.mutate({ id: u.id, patch })}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </Card>

      <AddStaffDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function UserRow({
  user,
  isMe,
  busy,
  onChange,
}: {
  user: Profile;
  isMe: boolean;
  busy: boolean;
  onChange: (patch: { role?: Role; is_active?: boolean }) => void;
}) {
  const role = toRole(user.role);
  return (
    <TableRow className="transition-colors hover:bg-accent/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary-soft text-xs text-primary">
              {initials(user.full_name ?? user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {user.full_name ?? "—"}{" "}
              {isMe ? <span className="text-xs text-muted-foreground">(you)</span> : null}
            </span>
            <span className="block truncate text-xs text-muted-foreground md:hidden">
              {user.email}
            </span>
            <span className="block text-xs text-muted-foreground">
              Since {formatDate(user.created_at)}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
        {user.email ?? "—"}
      </TableCell>
      <TableCell>
        <RoleBadge role={role} />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <StatusBadge
          tone={user.is_active ? "active" : "inactive"}
          label={user.is_active ? "Active" : "Inactive"}
        />
      </TableCell>
      <TableCell className="text-right">
        {isMe ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                aria-label={`Actions for ${user.full_name ?? user.email}`}
                disabled={busy}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Change role
              </DropdownMenuLabel>
              {roles.map((r) => (
                <DropdownMenuItem
                  key={r}
                  disabled={r === role}
                  onClick={() => onChange({ role: r })}
                >
                  <ShieldCheck className="size-4" /> {roleLabel(r)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {user.is_active ? (
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onClick={() => onChange({ is_active: false })}
                >
                  <UserX className="size-4" /> Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onChange({ is_active: true })}>
                  <UserCheck className="size-4" /> Activate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * Creating a login needs Supabase's admin API (secret key), which must never be
 * in the browser. Until an invite Edge Function exists, staff are invited from
 * the Supabase dashboard and then activated here.
 */
