import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  Download,
  LayoutGrid,
  List,
  Plus,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import { equipmentQueries, unitLabel, updateEquipmentUnit } from "@/lib/db/equipment";
import { queryKeys } from "@/lib/db/query-keys";
import type { EquipmentStatus, TransactionType } from "@/lib/db/types";
import { inr } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { equipmentStatusLabels, equipmentStatusTone, manualEquipmentStatuses } from "@/lib/status";

export const Route = createFileRoute("/_app/inventory/")({
  head: () => ({
    meta: [
      { title: "Inventory · Breath Care Kart" },
      {
        name: "description",
        content: "Every unit in the fleet with live status, serial numbers and rates.",
      },
    ],
  }),
  component: InventoryPage,
});

const PAGE_SIZE = 10;
const statusOptions = (Object.keys(equipmentStatusLabels) as EquipmentStatus[]).map((s) => ({
  value: s,
  label: equipmentStatusLabels[s],
}));

function InventoryPage() {
  const queryClient = useQueryClient();
  const units = useQuery(equipmentQueries.units());
  const types = useQuery(equipmentQueries.types());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [typeId, setTypeId] = useState("all");
  const [txType, setTxType] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const all = useMemo(() => units.data ?? [], [units.data]);
  const filtered = all.filter((u) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        [u.equipment_type?.name, u.brand, u.model, u.serial_number, u.unit_code].some((v) =>
          v?.toLowerCase().includes(q),
        )) &&
      (status === "all" || u.status === status) &&
      (typeId === "all" || u.equipment_type_id === typeId) &&
      (txType === "all" || u.available_for === txType)
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const count = (s: EquipmentStatus) => all.filter((u) => u.status === s).length;

  const bulkStatus = useMutation({
    mutationFn: async (next: EquipmentStatus) => {
      // Units on rent or sold change only through the rental/return/sale workflows.
      const eligible = all.filter(
        (u) => selected.includes(u.id) && u.status !== "on_rent" && u.status !== "sold",
      );
      for (const u of eligible) await updateEquipmentUnit(u.id, { status: next });
      return { updated: eligible.length, skipped: selected.length - eligible.length };
    },
    onSuccess: async ({ updated, skipped }, next) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.equipmentUnits.all });
      notifySuccess(
        `${updated} unit${updated === 1 ? "" : "s"} set to ${equipmentStatusLabels[next]}`,
        skipped ? `${skipped} on rent or sold were left unchanged.` : undefined,
      );
      setSelected([]);
    },
    onError: (error) => notifyError(error, "Couldn't update status"),
  });

  const setFilter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  const exportCsv = () =>
    downloadCsv(
      "inventory",
      [
        "Equipment",
        "Code",
        "Brand",
        "Model",
        "Serial",
        "Status",
        "For",
        "Monthly rate",
        "Sale price",
        "Purchase date",
      ],
      filtered.map((u) => [
        u.equipment_type?.name,
        u.unit_code,
        u.brand,
        u.model,
        u.serial_number,
        equipmentStatusLabels[u.status],
        u.available_for,
        u.monthly_rate,
        u.sale_price,
        u.purchase_date,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={
          units.data
            ? `${all.length} units · ${count("available")} available · ${count("on_rent")} on rent · ${count("sold")} sold`
            : "Every unit in the fleet"
        }
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
              <Link to="/inventory/new">
                <Plus className="size-4" /> Add equipment
              </Link>
            </Button>
          </>
        }
      />

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <FilterBar>
          <SearchFilter
            value={search}
            onChange={setFilter(setSearch)}
            placeholder="Search equipment, brand, model, code or serial"
          />
          <SelectFilter
            value={status}
            onChange={setFilter(setStatus)}
            allLabel="All statuses"
            options={statusOptions}
            className="sm:w-40"
          />
          <SelectFilter
            value={typeId}
            onChange={setFilter(setTypeId)}
            allLabel="All categories"
            options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
          <SelectFilter
            value={txType}
            onChange={setFilter(setTxType)}
            allLabel="Rental & sale"
            options={[
              { value: "rental", label: "Rental" },
              { value: "sale", label: "Sale" },
            ]}
            className="sm:w-40"
          />
          {txType !== "sale" && (
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link to="/inventory/rental-logs">
                <ScrollText className="size-4" /> Rental Logs
              </Link>
            </Button>
          )}
          {txType !== "rental" && (
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link to="/inventory/sales-logs">
                <ScrollText className="size-4" /> Sales Logs
              </Link>
            </Button>
          )}
          <div className="flex items-center rounded-xl border p-0.5">
            <Button
              size="icon"
              variant={view === "table" ? "secondary" : "ghost"}
              className="size-9 rounded-lg"
              onClick={() => setView("table")}
              aria-label="Table view"
            >
              <List className="size-4" />
            </Button>
            <Button
              size="icon"
              variant={view === "cards" ? "secondary" : "ghost"}
              className="size-9 rounded-lg"
              onClick={() => setView("cards")}
              aria-label="Card view"
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>
        </FilterBar>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-y bg-primary-soft px-4 py-2.5 text-sm">
            <span className="font-medium text-primary">{selected.length} selected</span>
            <Separator orientation="vertical" className="h-5" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg"
                  disabled={bulkStatus.isPending}
                >
                  <SlidersHorizontal className="size-3.5" /> Change status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {manualEquipmentStatuses.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => bulkStatus.mutate(s)}>
                    {equipmentStatusLabels[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
          </div>
        )}

        <Separator />

        <QueryState query={units} errorTitle="Couldn't load inventory">
          {() =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Boxes}
                  title={
                    all.length === 0 ? "No equipment yet" : "No equipment matches these filters"
                  }
                  description={
                    all.length === 0
                      ? "Add each physical unit (with its code or serial) so it can be rented or sold."
                      : "Try a different search, or clear the filters to see the full fleet."
                  }
                  action={
                    all.length === 0 ? (
                      <Button asChild className="mt-2 rounded-xl">
                        <Link to="/inventory/new">Add equipment</Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="mt-2 rounded-xl"
                        onClick={() => {
                          setSearch("");
                          setStatus("all");
                          setTypeId("all");
                          setTxType("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    )
                  }
                />
              </div>
            ) : view === "table" ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={() => setSelected(allChecked ? [] : rows.map((r) => r.id))}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Transaction</TableHead>
                    <TableHead className="hidden lg:table-cell">Serial</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id} className="transition-colors hover:bg-accent/50">
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(u.id)}
                          onCheckedChange={() =>
                            setSelected((s) =>
                              s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id],
                            )
                          }
                          aria-label={`Select ${unitLabel(u)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/inventory/$equipmentId"
                          params={{ equipmentId: u.id }}
                          className="group block"
                        >
                          <span className="block text-sm font-medium group-hover:text-primary">
                            {u.equipment_type?.name}
                            {u.unit_code ? ` · ${u.unit_code}` : ""}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {[u.brand, u.model].filter(Boolean).join(" ") || "—"}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {u.equipment_type?.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <TransactionBadge type={u.available_for as TransactionType} />
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                        {u.serial_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={equipmentStatusTone[u.status]}
                          label={equipmentStatusLabels[u.status]}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {u.available_for === "sale"
                          ? u.sale_price != null
                            ? inr(u.sale_price)
                            : "—"
                          : u.monthly_rate != null
                            ? `${inr(u.monthly_rate)}/mo`
                            : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((u) => (
                  <Link
                    key={u.id}
                    to="/inventory/$equipmentId"
                    params={{ equipmentId: u.id }}
                    className="card-hover rounded-2xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <Boxes className="size-5" />
                      </span>
                      <StatusBadge
                        tone={equipmentStatusTone[u.status]}
                        label={equipmentStatusLabels[u.status]}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{u.equipment_type?.name}</p>
                      <TransactionBadge type={u.available_for as TransactionType} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[u.brand, u.model].filter(Boolean).join(" ") || "—"}
                    </p>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">
                        {u.unit_code ?? u.serial_number ?? "—"}
                      </span>
                      <span className="font-medium">
                        {u.available_for === "sale"
                          ? u.sale_price != null
                            ? inr(u.sale_price)
                            : ""
                          : u.monthly_rate != null
                            ? `${inr(u.monthly_rate)}/mo`
                            : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          }
        </QueryState>

        {rows.length > 0 && pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(current - 1) * PAGE_SIZE + 1}–
              {Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(ev) => {
                      ev.preventDefault();
                      setPage(Math.max(1, current - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: pages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={current === i + 1}
                      onClick={(ev) => {
                        ev.preventDefault();
                        setPage(i + 1);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(ev) => {
                      ev.preventDefault();
                      setPage(Math.min(pages, current + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>
    </div>
  );
}
