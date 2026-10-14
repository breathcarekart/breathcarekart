import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Download,
  Eye,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RefreshCcw,
  Repeat,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  RenewRentalDialog,
  ReturnRentalDialog,
  type RentalRef,
} from "@/components/rentals/rental-actions";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DateRangeFilter,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { downloadCsv } from "@/lib/csv";
import { rentalQueries } from "@/lib/db/rentals";
import { formatDate, inDateRange } from "@/lib/format";
import { isOfficeRole, useCurrentUser } from "@/lib/roles";
import {
  isOpenRental,
  rentalStage,
  rentalStageLabels,
  rentalStageTone,
  type RentalStage,
} from "@/lib/status";

export const Route = createFileRoute("/_app/inventory/rental-logs")({
  head: () => ({
    meta: [
      { title: "Rental Logs · Breath Care Kart" },
      {
        name: "description",
        content: "Every rental with customer, equipment, dates, status and supervisor.",
      },
    ],
  }),
  component: RentalLogsPage,
});

const stageOptions = (Object.keys(rentalStageLabels) as RentalStage[]).map((s) => ({
  value: s,
  label: rentalStageLabels[s],
}));
const uniq = (pairs: [string, string][]) =>
  [...new Map(pairs).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

function RentalLogsPage() {
  const { role } = useCurrentUser();
  const office = isOfficeRole(role);
  const query = useQuery(rentalQueries.list());
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [stage, setStage] = useState("all");
  const [supervisor, setSupervisor] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [renewing, setRenewing] = useState<RentalRef | null>(null);
  const [returning, setReturning] = useState<RentalRef | null>(null);

  const rentals = useMemo(() => query.data ?? [], [query.data]);
  const itemNames = (r: (typeof rentals)[number]) =>
    r.rental_items.map((i) => i.description ?? i.equipment_type?.name ?? "Item");
  const customerOptions = useMemo(
    () => uniq(rentals.map((r) => [r.customer_id, r.customer?.name ?? "—"])),
    [rentals],
  );
  const equipmentOptions = useMemo(
    () =>
      uniq(
        rentals.flatMap((r) =>
          r.rental_items.map((i): [string, string] => [
            i.equipment_type?.id ?? "none",
            i.equipment_type?.name ?? "Other",
          ]),
        ),
      ),
    [rentals],
  );
  const supervisorOptions = useMemo(
    () =>
      uniq(
        rentals
          .filter((r) => r.supervisor)
          .map((r) => [
            r.supervisor!.id,
            r.supervisor!.full_name ?? r.supervisor!.email ?? "Supervisor",
          ]),
      ),
    [rentals],
  );

  const filtered = rentals.filter((r) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        [r.rental_number, r.customer?.name, ...itemNames(r)].some((v) =>
          v?.toLowerCase().includes(q),
        )) &&
      (customer === "all" || r.customer_id === customer) &&
      (equipment === "all" ||
        r.rental_items.some((i) => (i.equipment_type?.id ?? "none") === equipment)) &&
      (stage === "all" || rentalStage(r) === stage) &&
      (supervisor === "all" || r.supervisor_id === supervisor) &&
      inDateRange(r.start_date, from, to)
    );
  });

  const exportCsv = () =>
    downloadCsv(
      "rental-logs",
      [
        "Rental",
        "Customer",
        "Equipment",
        "Start",
        "End",
        "Returned",
        "Status",
        "Supervisor",
        "Deposit",
      ],
      filtered.map((r) => [
        r.rental_number,
        r.customer?.name,
        itemNames(r).join("; "),
        r.start_date,
        r.due_date,
        r.returned_date,
        rentalStageLabels[rentalStage(r)],
        r.supervisor?.full_name,
        r.deposit_amount,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rental Logs"
        description={
          query.data
            ? `${rentals.filter(isOpenRental).length} open · ${rentals.length} rentals on record`
            : "Every rental on record"
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
            {office && (
              <Button asChild className="rounded-xl">
                <Link to="/invoices/new" search={{ type: "rental" }}>
                  <Plus className="size-4" /> New rental
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <FilterBar>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search rental, customer or equipment"
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
            value={stage}
            onChange={setStage}
            allLabel="All statuses"
            options={stageOptions}
            className="sm:w-40"
          />
          {office && (
            <SelectFilter
              value={supervisor}
              onChange={setSupervisor}
              allLabel="All supervisors"
              options={supervisorOptions}
            />
          )}
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </FilterBar>
        <Separator />
        <QueryState query={query} errorTitle="Couldn't load rentals">
          {() =>
            filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Repeat}
                  title={rentals.length === 0 ? "No rentals yet" : "No rentals match these filters"}
                  description={
                    rentals.length === 0
                      ? office
                        ? "Rentals appear here once a rental invoice is created."
                        : "Rentals assigned to you will appear here."
                      : "Try a different search, or clear the filters."
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Rental ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Equipment</TableHead>
                    <TableHead className="hidden lg:table-cell">Start date</TableHead>
                    <TableHead className="hidden sm:table-cell">End date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden xl:table-cell">Supervisor</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = rentalStage(r);
                    const open = isOpenRental(r);
                    return (
                      <TableRow key={r.id} className="transition-colors hover:bg-accent/50">
                        <TableCell className="font-mono text-xs font-medium">
                          <Link
                            to="/deliveries/$rentalId"
                            params={{ rentalId: r.id }}
                            className="hover:text-primary"
                          >
                            {r.rental_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="block text-sm font-medium">{r.customer?.name}</span>
                          <span className="block text-xs text-muted-foreground md:hidden">
                            {itemNames(r).join(", ")}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {itemNames(r).join(", ")}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {formatDate(r.start_date)}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {formatDate(r.returned_date ?? r.due_date)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={rentalStageTone[st]} label={rentalStageLabels[st]} />
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                          {r.supervisor?.full_name ?? "Unassigned"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-lg"
                                aria-label={`Actions for ${r.rental_number}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link to="/deliveries/$rentalId" params={{ rentalId: r.id }}>
                                  <Eye className="size-4" /> View &amp; delivery
                                </Link>
                              </DropdownMenuItem>
                              {office && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem disabled={!open} onClick={() => setRenewing(r)}>
                                    <RefreshCcw className="size-4" /> Renew
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!open}
                                    onClick={() => setReturning(r)}
                                  >
                                    <PackageCheck className="size-4" /> Return
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          }
        </QueryState>
      </Card>

      <RenewRentalDialog rental={renewing} onClose={() => setRenewing(null)} />
      <ReturnRentalDialog rental={returning} onClose={() => setReturning(null)} />
    </div>
  );
}
