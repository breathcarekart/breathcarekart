import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleDollarSign, Clock, HandCoins, List, PackageCheck, Plus } from "lucide-react";
import { SalesTable } from "@/components/sales/sales-table";
import { saleAmount, saleInvoice } from "@/lib/sales";
import { EmptyState } from "@/components/shared/empty-state";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { saleQueries, type SaleWithRelations } from "@/lib/db/sales";
import { inr } from "@/lib/format";
import { outstandingOf } from "@/lib/status";

export const Route = createFileRoute("/_app/sales")({
  head: () => ({
    meta: [
      { title: "Sales · Breath Care Kart" },
      {
        name: "description",
        content: "Equipment sales overview: value, pending payments and recent sales.",
      },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const query = useQuery(saleQueries.list());
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Equipment sold outright — invoiced with GST, tracked to payment."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/inventory/sales-logs">
                <List className="size-4" /> Sales logs
              </Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/invoices/new" search={{ type: "sale" }}>
                <Plus className="size-4" /> New sale
              </Link>
            </Button>
          </>
        }
      />
      <QueryState query={query} loading={<CardsSkeleton />} errorTitle="Couldn't load sales">
        {(sales) => <SalesOverview sales={sales} />}
      </QueryState>
    </div>
  );
}

function SalesOverview({ sales }: { sales: SaleWithRelations[] }) {
  const live = sales.filter((s) => s.status !== "cancelled");
  const value = live.reduce((sum, s) => sum + saleAmount(s), 0);
  const unpaid = live.filter((s) => {
    const inv = saleInvoice(s);
    return inv ? outstandingOf(inv) > 0 : false;
  });
  const units = live.reduce((sum, s) => sum + s.sale_items.reduce((n, i) => n + i.quantity, 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales value"
          value={inr(value)}
          icon={CircleDollarSign}
          hint="incl. GST, excl. cancelled"
        />
        <StatCard
          label="Sales"
          value={String(live.length)}
          icon={HandCoins}
          hint={`${sales.length - live.length} cancelled`}
        />
        <StatCard
          label="Awaiting payment"
          value={String(unpaid.length)}
          icon={Clock}
          hint={inr(unpaid.reduce((s, x) => s + outstandingOf(saleInvoice(x)!), 0))}
        />
        <StatCard
          label="Units sold"
          value={String(units)}
          icon={PackageCheck}
          hint="all equipment"
        />
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Recent sales</h2>
            <p className="text-sm text-muted-foreground">Latest five</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="rounded-lg">
            <Link to="/inventory/sales-logs">View all</Link>
          </Button>
        </div>
        <Separator />
        {sales.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={HandCoins}
              title="No sales yet"
              description="Choose Sale as the transaction type when creating an invoice to record one."
              action={
                <Button asChild className="mt-2 rounded-xl">
                  <Link to="/invoices/new" search={{ type: "sale" }}>
                    Record a sale
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <SalesTable rows={sales.slice(0, 5)} />
        )}
      </Card>
    </div>
  );
}
