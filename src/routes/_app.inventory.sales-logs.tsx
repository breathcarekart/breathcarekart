import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, HandCoins, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { SalesTable } from "@/components/sales/sales-table";
import { saleAmount, saleStatus } from "@/lib/sales";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DateRangeFilter,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { downloadCsv } from "@/lib/csv";
import { saleQueries } from "@/lib/db/sales";
import { inDateRange, inr } from "@/lib/format";

export const Route = createFileRoute("/_app/inventory/sales-logs")({
  head: () => ({
    meta: [
      { title: "Sales Logs · Breath Care Kart" },
      {
        name: "description",
        content: "Every equipment sale with customer, amount, status and who created it.",
      },
    ],
  }),
  component: SalesLogsPage,
});

const uniq = (pairs: [string, string][]) =>
  [...new Map(pairs).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

function SalesLogsPage() {
  const query = useQuery(saleQueries.list());
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [createdBy, setCreatedBy] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const sales = useMemo(() => query.data ?? [], [query.data]);
  const customerOptions = useMemo(
    () => uniq(sales.map((s) => [s.customer_id, s.customer?.name ?? "—"])),
    [sales],
  );
  const equipmentOptions = useMemo(
    () =>
      uniq(
        sales.flatMap((s) =>
          s.sale_items.map((i): [string, string] => [
            i.equipment_type_id ?? i.description,
            i.description.split(" · ")[0] ?? i.description,
          ]),
        ),
      ),
    [sales],
  );
  const creatorOptions = useMemo(
    () =>
      uniq(
        sales.filter((s) => s.creator).map((s) => [s.creator!.id, s.creator!.full_name ?? "Staff"]),
      ),
    [sales],
  );
  const statusOptions = useMemo(
    () => uniq(sales.map((s) => [saleStatus(s).label, saleStatus(s).label])),
    [sales],
  );

  const filtered = sales.filter((s) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        [s.sale_number, s.customer?.name, ...s.sale_items.map((i) => i.description)].some((v) =>
          v?.toLowerCase().includes(q),
        )) &&
      (customer === "all" || s.customer_id === customer) &&
      (equipment === "all" ||
        s.sale_items.some((i) => (i.equipment_type_id ?? i.description) === equipment)) &&
      (createdBy === "all" || s.created_by === createdBy) &&
      (status === "all" || saleStatus(s).label === status) &&
      inDateRange(s.sale_date, from, to)
    );
  });
  const total = filtered
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + saleAmount(s), 0);

  const exportCsv = () =>
    downloadCsv(
      "sales-logs",
      ["Sale", "Date", "Customer", "Equipment", "Amount", "Created by", "Status"],
      filtered.map((s) => [
        s.sale_number,
        s.sale_date,
        s.customer?.name,
        s.sale_items.map((i) => i.description).join("; "),
        saleAmount(s),
        s.creator?.full_name,
        saleStatus(s).label,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Logs"
        description="Every equipment sale, who created it and where it stands."
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="size-4" /> Export
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/invoices/new" search={{ type: "sale" }}>
                <Plus className="size-4" /> New sale
              </Link>
            </Button>
          </>
        }
      />

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <FilterBar>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search sale, customer or equipment"
          />
          <SelectFilter
            value={customer}
            onChange={setCustomer}
            allLabel="All customers"
            options={customerOptions}
          />
          <SelectFilter
            value={equipment}
            onChange={setEquipment}
            allLabel="All equipment"
            options={equipmentOptions}
          />
          <SelectFilter
            value={createdBy}
            onChange={setCreatedBy}
            allLabel="Created by anyone"
            options={creatorOptions}
          />
          <SelectFilter
            value={status}
            onChange={setStatus}
            allLabel="All statuses"
            options={statusOptions}
            className="sm:w-40"
          />
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </FilterBar>
        <Separator />
        <QueryState query={query} errorTitle="Couldn't load sales">
          {() =>
            filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={HandCoins}
                  title={sales.length === 0 ? "No sales yet" : "No sales match these filters"}
                  description={
                    sales.length === 0
                      ? "Sales appear here once a sale invoice is generated."
                      : "Try a different search, or clear the filters."
                  }
                  action={
                    sales.length === 0 ? (
                      <Button asChild className="mt-2 rounded-xl">
                        <Link to="/invoices/new" search={{ type: "sale" }}>
                          Record first sale
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <SalesTable rows={filtered} />
            )
          }
        </QueryState>
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {filtered.length} of {sales.length} sales
            </span>
            <span>
              Total (excl. cancelled):{" "}
              <span className="font-medium text-foreground">{inr(total)}</span>
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
