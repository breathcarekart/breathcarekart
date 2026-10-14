import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createEquipmentUnit, equipmentQueries } from "@/lib/db/equipment";
import { queryKeys } from "@/lib/db/query-keys";
import type { EquipmentStatus } from "@/lib/db/types";
import { notifyError, notifySuccess } from "@/lib/notify";
import { equipmentStatusLabels, manualEquipmentStatuses } from "@/lib/status";

export const Route = createFileRoute("/_app/inventory/new")({
  head: () => ({
    meta: [
      { title: "Add equipment · Breath Care Kart" },
      { name: "description", content: "Register a physical equipment unit for rental or sale." },
    ],
  }),
  component: AddEquipmentPage,
});

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const money = (v: string) => (v.trim() === "" ? null : Number(v));
const badMoney = (v: string) => v.trim() !== "" && !(Number(v) >= 0);

function AddEquipmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const types = useQuery(equipmentQueries.types());

  const [typeId, setTypeId] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [availableFor, setAvailableFor] = useState<"rental" | "sale">("rental");
  const [status, setStatus] = useState<EquipmentStatus>("available");
  const [dailyRate, setDailyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    type: !typeId ? "Choose a category" : undefined,
    unitCode:
      !unitCode.trim() && !serial.trim()
        ? "Enter a unit code or serial number to identify this unit"
        : undefined,
    dailyRate: badMoney(dailyRate) ? "Enter a valid amount" : undefined,
    monthlyRate: badMoney(monthlyRate) ? "Enter a valid amount" : undefined,
    salePrice: badMoney(salePrice) ? "Enter a valid amount" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (e: string | undefined) => (submitted ? e : undefined);

  const create = useMutation({
    mutationFn: () =>
      createEquipmentUnit({
        equipment_type_id: typeId,
        unit_code: unitCode.trim() || null,
        serial_number: serial.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        purchase_date: purchaseDate || null,
        status,
        available_for: availableFor,
        daily_rate: availableFor === "rental" ? money(dailyRate) : null,
        monthly_rate: availableFor === "rental" ? money(monthlyRate) : null,
        sale_price: availableFor === "sale" ? money(salePrice) : null,
        notes: notes.trim() || null,
      }),
    onSuccess: async (unit) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.equipmentUnits.all });
      notifySuccess("Equipment added", unit.unit_code ?? unit.serial_number ?? undefined);
      navigate({ to: "/inventory/$equipmentId", params: { equipmentId: unit.id } });
    },
    onError: (error) => notifyError(error, "Couldn't add equipment"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add equipment"
        description="Register one physical unit. Each unit is rented or sold individually."
        actions={
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => navigate({ to: "/inventory" })}
          >
            <ArrowLeft className="size-4" /> Back to inventory
          </Button>
        }
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (valid) create.mutate();
        }}
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-6">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Asset identity</h2>
            <p className="text-sm text-muted-foreground">
              How this unit appears on rentals, sales and invoices.
            </p>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category *" error={show(errors.type)}>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger className="h-10 rounded-xl" aria-invalid={!!show(errors.type)}>
                    <SelectValue placeholder={types.isPending ? "Loading…" : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(types.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Unit code"
                hint="Your label for this unit, e.g. OC-5L-014. Must be unique."
                error={show(errors.unitCode)}
              >
                <Input
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  className="h-10 rounded-xl font-mono"
                />
              </Field>
              <Field label="Brand">
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Model">
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Serial number" hint="Printed on the unit's label.">
                <Input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  className="h-10 rounded-xl font-mono"
                />
              </Field>
              <Field label="Purchase date">
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </Field>
            </div>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Availability &amp; pricing</h2>
            <p className="text-sm text-muted-foreground">
              Rates are defaults on new invoices; each invoice keeps its own rate.
            </p>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Transaction type">
                <Select
                  value={availableFor}
                  onValueChange={(v) => setAvailableFor(v as "rental" | "sale")}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rental">Rental</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as EquipmentStatus)}>
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
              </Field>
              {availableFor === "rental" ? (
                <>
                  <Field label="Monthly rate (₹)" error={show(errors.monthlyRate)}>
                    <Input
                      type="number"
                      min={0}
                      value={monthlyRate}
                      onChange={(e) => setMonthlyRate(e.target.value)}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="Daily rate (₹)" error={show(errors.dailyRate)}>
                    <Input
                      type="number"
                      min={0}
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                </>
              ) : (
                <Field label="Selling price (₹)" error={show(errors.salePrice)}>
                  <Input
                    type="number"
                    min={0}
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </Field>
              )}
            </div>
            <div className="mt-5">
              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Accessories included, storage location, service history…"
                  className="min-h-24 rounded-xl"
                />
              </Field>
            </div>
          </Card>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-xs lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Before you save</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>· Unit codes must be unique across the fleet.</li>
            <li>· Only Available units can be selected on a new invoice.</li>
            <li>· On rent and Sold are set automatically by rentals, returns and sales.</li>
          </ul>
          <Separator className="my-5" />
          <div className="flex flex-col gap-2">
            <Button type="submit" className="h-11 rounded-xl" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {create.isPending ? "Saving…" : "Save equipment"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => navigate({ to: "/inventory" })}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
