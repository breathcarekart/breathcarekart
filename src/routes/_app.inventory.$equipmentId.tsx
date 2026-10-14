import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, HandCoins, Repeat } from "lucide-react";
import { TransactionBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { equipmentQueries, updateEquipmentUnit, type fetchEquipmentUnit } from "@/lib/db/equipment";
import { queryKeys } from "@/lib/db/query-keys";
import type { EquipmentStatus, TransactionType } from "@/lib/db/types";
import { formatDate, inr } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  equipmentStatusLabels,
  equipmentStatusTone,
  manualEquipmentStatuses,
  rentalStage,
  rentalStageLabels,
  rentalStageTone,
} from "@/lib/status";

export const Route = createFileRoute("/_app/inventory/$equipmentId")({
  head: () => ({
    meta: [{ title: "Equipment · Breath Care Kart" }, { name: "robots", content: "noindex" }],
  }),
  component: EquipmentDetailsPage,
});

type UnitDetail = Awaited<ReturnType<typeof fetchEquipmentUnit>>;

function EquipmentDetailsPage() {
  const { equipmentId } = Route.useParams();
  const query = useQuery(equipmentQueries.unit(equipmentId));
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
        <Link to="/inventory">
          <ArrowLeft className="size-4" /> Inventory
        </Link>
      </Button>
      <QueryState
        query={query}
        loading={<CardsSkeleton />}
        errorTitle="Couldn't load this equipment"
      >
        {(unit) => <EquipmentDetails unit={unit} />}
      </QueryState>
    </div>
  );
}

function EquipmentDetails({ unit }: { unit: UnitDetail }) {
  const queryClient = useQueryClient();
  const txType = unit.available_for as TransactionType;
  const title = `${unit.equipment_type?.name ?? "Equipment"}${unit.unit_code ? ` · ${unit.unit_code}` : ""}`;
  const locked = unit.status === "on_rent" || unit.status === "sold";

  const setStatus = useMutation({
    mutationFn: (status: EquipmentStatus) => updateEquipmentUnit(unit.id, { status }),
    onSuccess: async (_, status) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.equipmentUnits.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });
      notifySuccess(`Status set to ${equipmentStatusLabels[status]}`);
    },
    onError: (error) => notifyError(error, "Couldn't change status"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={
          [unit.brand, unit.model, unit.serial_number ? `S/N ${unit.serial_number}` : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          unit.status === "available" ? (
            <Button asChild className="rounded-xl">
              <Link to="/invoices/new" search={{ type: txType, equipment: unit.id }}>
                {txType === "sale" ? (
                  <HandCoins className="size-4" />
                ) : (
                  <Repeat className="size-4" />
                )}
                {txType === "sale" ? "Sell this unit" : "Rent this unit"}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="mt-1">
            <StatusBadge
              tone={equipmentStatusTone[unit.status]}
              label={equipmentStatusLabels[unit.status]}
            />
          </div>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Transaction type</p>
          <div className="mt-1">
            <TransactionBadge type={txType} className="text-sm" />
          </div>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">
            {txType === "sale" ? "Selling price" : "Monthly rate"}
          </p>
          <p className="text-xl font-semibold">
            {txType === "sale"
              ? unit.sale_price != null
                ? inr(unit.sale_price)
                : "—"
              : unit.monthly_rate != null
                ? inr(unit.monthly_rate)
                : "—"}
          </p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">In fleet since</p>
          <p className="text-xl font-semibold">
            {formatDate(unit.purchase_date ?? unit.created_at)}
          </p>
        </Card>
      </div>

      <Card className="gap-0 p-6 shadow-xs">
        <Tabs defaultValue="overview">
          <TabsList className="h-auto flex-wrap rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg">
              Overview
            </TabsTrigger>
            <TabsTrigger value="rentals" className="rounded-lg">
              Rental History
            </TabsTrigger>
            <TabsTrigger value="sales" className="rounded-lg">
              Sales History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5 space-y-6">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Category", unit.equipment_type?.name],
                ["Unit code", unit.unit_code],
                ["Brand", unit.brand],
                ["Model", unit.model],
                ["Serial number", unit.serial_number],
                ["Purchase date", unit.purchase_date ? formatDate(unit.purchase_date) : null],
                ["Daily rate", unit.daily_rate != null ? inr(unit.daily_rate) : null],
                ["Monthly rate", unit.monthly_rate != null ? inr(unit.monthly_rate) : null],
                ["Selling price", unit.sale_price != null ? inr(unit.sale_price) : null],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {unit.notes ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">{unit.notes}</p>
            ) : null}
            <Separator />
            <div className="max-w-xs space-y-2">
              <Label className="text-sm">Change status</Label>
              {locked ? (
                <p className="text-sm text-muted-foreground">
                  {unit.status === "on_rent"
                    ? "On rent — it becomes available when the rental is returned."
                    : "Sold units stay on record."}
                </p>
              ) : (
                <Select
                  value={unit.status}
                  onValueChange={(v) => setStatus.mutate(v as EquipmentStatus)}
                  disabled={setStatus.isPending}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {manualEquipmentStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {equipmentStatusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rentals" className="mt-5">
            {unit.rental_items.length === 0 ? (
              <EmptyState
                icon={Repeat}
                title="No rentals yet"
                description="Rentals of this unit will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Rental</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unit.rental_items.map((it) =>
                    it.rental ? (
                      <TableRow key={it.id} className="hover:bg-accent/50">
                        <TableCell className="font-mono text-xs font-medium">
                          <Link
                            to="/deliveries/$rentalId"
                            params={{ rentalId: it.rental.id }}
                            className="hover:text-primary"
                          >
                            {it.rental.rental_number}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{it.rental.customer?.name}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {formatDate(it.rental.start_date)} →{" "}
                          {formatDate(it.rental.returned_date ?? it.rental.due_date)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            tone={rentalStageTone[rentalStage(it.rental)]}
                            label={rentalStageLabels[rentalStage(it.rental)]}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {it.rate != null ? inr(it.rate) : "—"}
                        </TableCell>
                      </TableRow>
                    ) : null,
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="sales" className="mt-5">
            {unit.sale_items.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title="No sales recorded"
                description={
                  txType === "sale"
                    ? "When this unit is sold, the sale will appear here."
                    : "This unit is listed for rental."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Sale</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unit.sale_items.map((it) =>
                    it.sale ? (
                      <TableRow key={it.id} className="hover:bg-accent/50">
                        <TableCell className="font-mono text-xs font-medium">
                          {it.sale.sale_number}
                        </TableCell>
                        <TableCell className="font-medium">{it.sale.customer?.name}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {formatDate(it.sale.sale_date)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {inr(it.unit_price)}
                        </TableCell>
                      </TableRow>
                    ) : null,
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
