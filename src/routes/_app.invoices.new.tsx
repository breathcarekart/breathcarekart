import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, FileCheck2, Loader2, Minus, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { TransactionBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { PreviewNotice } from "@/components/shared/preview-notice";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { customerQueries } from "@/lib/db/customers";
import { equipmentQueries, unitLabel } from "@/lib/db/equipment";
import { createInvoice } from "@/lib/db/invoices";
import { profileQueries } from "@/lib/db/profiles";
import { workflowKeys } from "@/lib/db/query-keys";
import type { TransactionType } from "@/lib/db/types";
import { addMonthsISO, formatDate, inr, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { equipmentStatusLabels, equipmentStatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

type CreateInvoiceSearch = {
  type?: TransactionType | undefined;
  customer?: string | undefined;
  equipment?: string | undefined;
};

export const Route = createFileRoute("/_app/invoices/new")({
  head: () => ({
    meta: [
      { title: "Create invoice · Breath Care Kart" },
      { name: "description", content: "Create a rental or sale with its GST invoice." },
    ],
  }),
  // Lets other screens open this form pre-set (customer, rental/sale, a unit).
  validateSearch: (search: Record<string, unknown>): CreateInvoiceSearch => ({
    type: search["type"] === "sale" || search["type"] === "rental" ? search["type"] : undefined,
    customer: typeof search["customer"] === "string" ? search["customer"] : undefined,
    equipment: typeof search["equipment"] === "string" ? search["equipment"] : undefined,
  }),
  component: CreateInvoicePage,
});

/** GST options offered. The right rate depends on each item's HSN code; staff choose per invoice. */
const GST_RATES = ["0", "5", "12", "18", "28"] as const;

const flowSteps = [
  "Customer",
  "Transaction Type",
  "Equipment / Items",
  "Charges",
  "GST",
  "Invoice Preview",
  "Generate Invoice",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function SectionCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 p-6 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Separator className="my-5" />
      {children}
    </Card>
  );
}

type Line = { unitId: string; rate: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: string) => Math.max(0, Number(v) || 0);

function CreateInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const customers = useQuery(customerQueries.list());
  const units = useQuery(equipmentQueries.units());
  const staff = useQuery(profileQueries.list());

  const [customerId, setCustomerId] = useState(search.customer ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [txType, setTxType] = useState<TransactionType>(search.type ?? "rental");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());
  const [startDate, setStartDate] = useState(todayISO());
  const [months, setMonths] = useState(1);
  const [supervisorId, setSupervisorId] = useState("none");
  const [itemQuery, setItemQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [preselected, setPreselected] = useState(false);
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [deposit, setDeposit] = useState("0");
  const [gstRate, setGstRate] = useState<string>("");
  const [notes, setNotes] = useState("");

  const isRental = txType === "rental";
  const customer = customers.data?.find((c) => c.id === customerId);
  const unitById = useMemo(() => new Map((units.data ?? []).map((u) => [u.id, u])), [units.data]);
  const defaultRate = (unitId: string, type: TransactionType) => {
    const u = unitById.get(unitId);
    return Number((type === "rental" ? u?.monthly_rate : u?.sale_price) ?? 0);
  };

  // Pre-select a unit passed from the equipment page, once units load.
  if (!preselected && search.equipment && units.data) {
    setPreselected(true);
    const u = unitById.get(search.equipment);
    if (u && u.status === "available")
      setLines([{ unitId: u.id, rate: defaultRate(u.id, txType) }]);
  }

  const supervisors = (staff.data ?? []).filter((p) => p.role === "supervisor" && p.is_active);
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return (customers.data ?? [])
      .filter((c) =>
        [c.name, c.phone, c.city, c.attender_name].some((v) => v?.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [customerQuery, customers.data]);

  const pool = (units.data ?? []).filter(
    (u) =>
      u.available_for === txType &&
      (u.status === "available" || lines.some((l) => l.unitId === u.id)) &&
      (!itemQuery ||
        [u.equipment_type?.name, u.brand, u.model, u.unit_code, u.serial_number].some((v) =>
          v?.toLowerCase().includes(itemQuery.toLowerCase()),
        )),
  );

  const changeType = (next: TransactionType) => {
    setTxType(next);
    setLines([]); // rental and sale items differ
  };
  const toggleLine = (unitId: string) =>
    setLines((ls) =>
      ls.some((l) => l.unitId === unitId)
        ? ls.filter((l) => l.unitId !== unitId)
        : [...ls, { unitId, rate: defaultRate(unitId, txType) }],
    );

  // Preview only — the database recalculates and stores the authoritative totals.
  const lineAmount = (l: Line) => round2(l.rate * (isRental ? months : 1));
  const delivery = num(deliveryCharge);
  const disc = num(discount);
  const subtotal = round2(lines.reduce((s, l) => s + lineAmount(l), 0) + delivery);
  const taxable = Math.max(0, round2(subtotal - disc));
  const rate = gstRate === "" ? null : Number(gstRate);
  const gst = rate == null ? 0 : round2((taxable * rate) / 100);
  const total = round2(taxable + gst);
  const endDate = addMonthsISO(startDate, months);

  const problems = [
    !customerId && "Select a customer",
    lines.length === 0 && "Add at least one item",
    lines.some((l) => !(l.rate > 0)) && "Enter a rate for every item",
    rate == null && "Choose a GST rate",
    disc > subtotal && "Discount is more than the subtotal",
    dueDate < invoiceDate && "Payment due date is before the invoice date",
  ].filter(Boolean) as string[];

  const create = useMutation({
    mutationFn: () =>
      createInvoice({
        transaction_type: txType,
        customer_id: customerId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        tax_rate: rate ?? 0,
        discount: disc,
        delivery_charge: delivery,
        notes: notes.trim() || undefined,
        ...(isRental
          ? {
              start_date: startDate,
              end_date: endDate,
              supervisor_id: supervisorId === "none" ? undefined : supervisorId,
              deposit_amount: num(deposit),
            }
          : {}),
        items: lines.map((l) => ({
          equipment_unit_id: l.unitId,
          rate: l.rate,
          ...(isRental ? { months } : {}),
        })),
      }),
    onSuccess: async (result) => {
      await Promise.all(
        workflowKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      notifySuccess(
        `Invoice ${result.invoice_number} created`,
        isRental
          ? "Rental started and equipment marked on rent."
          : "Sale recorded and equipment marked sold.",
      );
      navigate({ to: "/invoices/$invoiceId", params: { invoiceId: result.invoice_id } });
    },
    onError: (error) => notifyError(error, "Couldn't create the invoice"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create invoice"
        description="Customer → transaction type → items → charges → GST → preview → generate."
      />

      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Invoice steps">
        {flowSteps.map((label, i) => (
          <li
            key={label}
            className="flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <SectionCard
            step={1}
            title="Customer"
            description="Search an existing customer, or add a new one first."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search customer..."
                  aria-label="Search customer"
                  className="h-10 rounded-xl pl-9"
                />
              </div>
              <Button asChild variant="outline" className="h-10 rounded-xl">
                <Link to="/customers/new">
                  <UserPlus className="size-4" /> Add New Customer
                </Link>
              </Button>
            </div>

            {customerQuery.trim() && (
              <div className="mt-2 overflow-hidden rounded-xl border">
                {customerMatches.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    No customers match “{customerQuery}”.
                  </p>
                ) : (
                  customerMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerQuery("");
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b px-4 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-accent/60"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[c.phone, c.city].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {c.id === customerId && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  ))
                )}
              </div>
            )}

            {customer ? (
              <div className="mt-4 grid gap-4 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Selected customer
                  </p>
                  <p className="mt-1 text-sm font-semibold">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.phone}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Attender</p>
                  <p className="mt-1 text-sm font-medium">
                    {customer.attender_name ?? "—"}{" "}
                    {customer.attender_relation ? (
                      <span className="text-muted-foreground">({customer.attender_relation})</span>
                    ) : null}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Address</p>
                  <p className="mt-1 text-sm">
                    {[customer.address, customer.city].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                {customers.isPending
                  ? "Loading customers…"
                  : "Search and select a customer to continue."}
              </p>
            )}
          </SectionCard>

          <SectionCard
            step={2}
            title="Transaction type"
            description="Rent the equipment out, or sell it outright."
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Transaction type">
                <Select value={txType} onValueChange={(v) => changeType(v as TransactionType)}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rental">Rental</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Invoice date">
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Payment due">
                <Input
                  type="date"
                  value={dueDate}
                  min={invoiceDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </Field>

              {/* Keyed so rental fields never reuse another field's state. */}
              {isRental ? (
                <Fragment key="rental-fields">
                  <Field label="Rental start date">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="Rental period">
                    <Stepper
                      value={months}
                      onChange={setMonths}
                      suffix={months === 1 ? "month" : "months"}
                    />
                  </Field>
                  <Field label="Ends on">
                    <Input
                      readOnly
                      value={formatDate(endDate)}
                      className="h-10 rounded-xl bg-muted/50"
                    />
                  </Field>
                  <Field label="Delivery supervisor">
                    <Select value={supervisorId} onValueChange={setSupervisorId}>
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Assign later</SelectItem>
                        {supervisors.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name ?? s.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </Fragment>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            step={3}
            title="Equipment / Items"
            description={
              isRental
                ? "Choose available units to rent. Each unit is one line."
                : "Choose the units being sold."
            }
          >
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder={isRental ? "Search rental equipment" : "Search equipment for sale"}
                className="h-10 rounded-xl pl-9"
              />
            </div>
            {pool.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {units.isPending
                  ? "Loading equipment…"
                  : `No available ${isRental ? "rental" : "sale"} equipment${itemQuery ? " matches this search" : ""}.`}{" "}
                {!units.isPending && (
                  <Link to="/inventory/new" className="text-primary hover:underline">
                    Add equipment
                  </Link>
                )}
              </p>
            ) : (
              <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {pool.map((u) => {
                  const active = lines.some((l) => l.unitId === u.id);
                  const price = isRental ? u.monthly_rate : u.sale_price;
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggleLine(u.id)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all duration-200 hover:shadow-soft",
                        active
                          ? "border-primary bg-primary-soft shadow-soft"
                          : "hover:border-primary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">
                          {u.equipment_type?.name}
                          {u.unit_code ? ` · ${u.unit_code}` : ""}
                        </span>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {active ? <Check className="size-3" /> : null}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[u.brand, u.model].filter(Boolean).join(" ") || "—"}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <StatusBadge
                          tone={equipmentStatusTone[u.status]}
                          label={equipmentStatusLabels[u.status]}
                        />
                        <span className="text-sm font-medium">
                          {price != null
                            ? `${inr(price)}${isRental ? "/mo" : ""}`
                            : "No default rate"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  Select equipment above to set the rate.
                </p>
              ) : (
                lines.map((l) => {
                  const u = unitById.get(l.unitId);
                  if (!u) return null;
                  return (
                    <div
                      key={l.unitId}
                      className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{unitLabel(u)}</p>
                        <p className="text-xs text-muted-foreground">
                          1 unit
                          {isRental ? ` × ${months} ${months === 1 ? "month" : "months"}` : ""}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label
                          className="text-xs text-muted-foreground"
                          htmlFor={`rate-${l.unitId}`}
                        >
                          {isRental ? "Rate / month (₹)" : "Selling price (₹)"}
                        </Label>
                        <Input
                          id={`rate-${l.unitId}`}
                          type="number"
                          min={0}
                          value={l.rate || ""}
                          onChange={(ev) =>
                            setLines((ls) =>
                              ls.map((x) =>
                                x.unitId === l.unitId ? { ...x, rate: num(ev.target.value) } : x,
                              ),
                            )
                          }
                          className="h-9 w-full rounded-lg sm:w-36"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className="text-sm font-semibold sm:w-24 sm:text-right">
                          {inr(lineAmount(l))}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 rounded-lg text-danger hover:text-danger"
                          onClick={() => toggleLine(l.unitId)}
                          aria-label={`Remove ${unitLabel(u)}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard
            step={4}
            title="Charges"
            description={
              isRental ? "Delivery, discount and refundable deposit." : "Delivery and discount."
            }
          >
            <div className={cn("grid gap-5", isRental ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              <Field label="Delivery charge (₹)">
                <Input
                  type="number"
                  min={0}
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Discount (₹)">
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </Field>
              {isRental && (
                <Field label="Refundable deposit (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </Field>
              )}
            </div>
            <div className="mt-5">
              <Field label="Invoice notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery instructions, payment terms…"
                  className="min-h-24 rounded-xl"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            step={5}
            title="GST"
            description="Choose the GST rate that applies to these items."
          >
            <div className="grid gap-5 sm:grid-cols-[220px_1fr] sm:items-start">
              <Field label="GST Percentage">
                <Select value={gstRate} onValueChange={setGstRate}>
                  <SelectTrigger className="h-10 rounded-xl" aria-invalid={gstRate === ""}>
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <PreviewNotice className="sm:mt-7">
                The rate is saved on this invoice. GST differs by equipment (HSN code) and by rental
                vs sale — confirm the correct rate with your accountant.
              </PreviewNotice>
            </div>
          </SectionCard>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-soft lg:sticky lg:top-24">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Invoice preview</h2>
              <p className="text-sm text-muted-foreground">Step 6 · review before generating</p>
            </div>
            <TransactionBadge type={txType} />
          </div>
          <Separator className="my-5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{customer?.name ?? "No customer selected"}</p>
            <p className="text-xs text-muted-foreground">
              {customer ? [customer.address, customer.city].filter(Boolean).join(", ") : ""}
            </p>
          </div>
          <Separator className="my-4" />
          <div className="space-y-2.5">
            {lines.map((l) => {
              const u = unitById.get(l.unitId);
              return (
                <div key={l.unitId} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{u ? unitLabel(u) : ""}</span>
                    <span className="block text-xs text-muted-foreground">
                      {inr(l.rate)}
                      {isRental ? ` × ${months} mo` : ""}
                    </span>
                  </span>
                  <span className="font-medium">{inr(lineAmount(l))}</span>
                </div>
              );
            })}
            {delivery > 0 && (
              <div className="flex justify-between text-sm">
                <span>Delivery charge</span>
                <span className="font-medium">{inr(delivery)}</span>
              </div>
            )}
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">No items selected yet.</p>
            )}
          </div>
          <Separator className="my-4" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{inr(subtotal)}</dd>
            </div>
            {disc > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="text-danger">−{inr(disc)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST ({rate ?? "–"}%)</dt>
              <dd>{inr(gst)}</dd>
            </div>
          </dl>
          <Separator className="my-4" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-2xl font-semibold tracking-tight">{inr(total)}</span>
          </div>
          {isRental && num(deposit) > 0 && (
            <p className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Refundable deposit (recorded on the rental, not part of the invoice)</span>
              <span className="font-medium text-foreground">{inr(num(deposit))}</span>
            </p>
          )}

          {problems.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {problems.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <Button
              className="h-11 rounded-xl"
              disabled={problems.length > 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileCheck2 className="size-4" />
              )}
              {create.isPending ? "Generating…" : "Generate invoice"}
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => navigate({ to: "/invoices" })}
              disabled={create.isPending}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  suffix: string;
}) {
  return (
    <div className="flex h-10 w-fit items-center gap-1 rounded-xl border p-0.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 rounded-lg"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Fewer months"
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-20 text-center text-sm">
        {value} {suffix}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 rounded-lg"
        onClick={() => onChange(Math.min(60, value + 1))}
        aria-label="More months"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
