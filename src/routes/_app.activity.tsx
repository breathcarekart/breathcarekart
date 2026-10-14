import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityList } from "@/components/activity/activity-list";
import { EmptyState } from "@/components/shared/empty-state";
import { DateRangeFilter, FilterBar, SelectFilter } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { activityQueries } from "@/lib/db/activity";
import { inDateRange } from "@/lib/format";
import { roleLabel, roles, toRole } from "@/lib/roles";

export const Route = createFileRoute("/_app/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log · Breath Care Kart" },
      {
        name: "description",
        content:
          "Who created invoices, assigned rentals, confirmed deliveries and recorded payments.",
      },
    ],
  }),
  component: ActivityPage,
});

const typeLabels: Record<string, string> = {
  customer: "Customer",
  equipment: "Equipment",
  rental: "Rental & delivery",
  sale: "Sale",
  invoice: "Invoice",
  payment: "Payment",
  profile: "User",
};

function ActivityPage() {
  const query = useQuery(activityQueries.recent(500));
  const [user, setUser] = useState("all");
  const [role, setRole] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const entries = useMemo(() => query.data ?? [], [query.data]);
  const userOptions = useMemo(
    () =>
      [
        ...new Map(
          entries.filter((e) => e.actor).map((e) => [e.actor!.id, e.actor!.full_name ?? "Staff"]),
        ).entries(),
      ].map(([value, label]) => ({
        value,
        label,
      })),
    [entries],
  );

  const filtered = entries.filter(
    (e) =>
      (user === "all" || e.actor_id === user) &&
      (role === "all" || (e.actor && toRole(e.actor.role) === role)) &&
      (type === "all" || e.entity_type === type) &&
      inDateRange(e.created_at, from, to),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Every important action, and who performed it."
      />
      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <FilterBar>
          <SelectFilter
            value={user}
            onChange={setUser}
            allLabel="All users"
            options={userOptions}
          />
          <SelectFilter
            value={role}
            onChange={setRole}
            allLabel="All roles"
            options={roles.map((r) => ({ value: r, label: roleLabel(r) }))}
            className="sm:w-36"
          />
          <SelectFilter
            value={type}
            onChange={setType}
            allLabel="All activity"
            options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))}
            className="sm:w-40"
          />
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </FilterBar>
        <Separator />
        <QueryState query={query} errorTitle="Couldn't load activity">
          {() =>
            filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={History}
                  title={
                    entries.length === 0 ? "No activity yet" : "No activity matches these filters"
                  }
                  description={
                    entries.length === 0
                      ? "Actions like new customers, invoices, payments and deliveries are recorded here automatically."
                      : "Try another user, role or date range."
                  }
                />
              </div>
            ) : (
              <div className="px-4">
                <ActivityList entries={filtered} />
              </div>
            )
          }
        </QueryState>
        {filtered.length > 0 && (
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {entries.length} most recent events
          </p>
        )}
      </Card>
    </div>
  );
}
