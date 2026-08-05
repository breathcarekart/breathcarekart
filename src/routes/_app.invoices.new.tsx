import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, FileCheck2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customers, equipment, inr } from "@/lib/data";

export const Route = createFileRoute("/_app/invoices/new")({
  head: () => ({
    meta: [
      { title: "Create invoice · Breath Care Kart" },
      {
        name: "description",
        content:
          "Build a rental invoice: patient and attender details, multi-item equipment selection, rental period and charges.",
      },
      { property: "og:title", content: "Create invoice · Breath Care Kart" },
      { property: "og:description", content: "Build a multi-item medical equipment rental invoice in one flow." },
    ],
  }),
  component: CreateInvoicePage,
});

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

function CreateInvoicePage() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState(customers[0]!.id);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<{ id: string; months: number }[]>([{ id: "EQ-1001", months: 1 }]);
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(5000);
  const [gst, setGst] = useState(true);

  const customer = customers.find((c) => c.id === customerId)!;
  const pool = useMemo(
    () =>
      equipment.filter(
        (e) =>
          (e.status === "available" || lines.some((l) => l.id === e.id)) &&
          (!query || [e.name, e.brand, e.type].some((v) => v.toLowerCase().includes(query.toLowerCase()))),
      ),
    [query, lines],
  );

  const toggleLine = (id: string) =>
    setLines((ls) => (ls.some((l) => l.id === id) ? ls.filter((l) => l.id !== id) : [...ls, { id, months: 1 }]));
  const setMonths = (id: string, delta: number) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, months: Math.max(1, l.months + delta) } : l)));

  const subtotal = lines.reduce((s, l) => {
    const e = equipment.find((x) => x.id === l.id);
    return s + (e ? e.monthlyRate * l.months : 0);
  }, 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = gst ? Math.round(taxable * 0.12) : 0;
  const total = taxable + tax + deposit;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create invoice"
        description="Six guided steps — patient details to generated invoice. Everything saves as a draft as you go."
        actions={
          <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Draft saved")}>
            Save draft
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard step={1} title="Patient details" description="Pick an existing account or enter a new patient.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Customer account">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Age / gender">
                <Input readOnly value={`${customer.age} · ${customer.gender}`} className="h-10 rounded-xl bg-muted/50" />
              </Field>
              <Field label="Phone">
                <Input readOnly value={customer.phone} className="h-10 rounded-xl bg-muted/50" />
              </Field>
              <Field label="Delivery address">
                <Input readOnly value={customer.address} className="h-10 rounded-xl bg-muted/50" />
              </Field>
            </div>
          </SectionCard>

          <SectionCard step={2} title="Attender details" description="Primary contact responsible for the equipment.">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Attender name">
                <Input defaultValue={customer.attender} className="h-10 rounded-xl" />
              </Field>
              <Field label="Relationship">
                <Input defaultValue={customer.attenderRelation} className="h-10 rounded-xl" />
              </Field>
              <Field label="WhatsApp">
                <Input defaultValue={customer.whatsapp} className="h-10 rounded-xl" />
              </Field>
            </div>
          </SectionCard>

          <SectionCard step={3} title="Equipment selection" description="Add one or more units. Only available assets are listed.">
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search available equipment"
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pool.map((e) => {
                const active = lines.some((l) => l.id === e.id);
                return (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => toggleLine(e.id)}
                    className={`rounded-2xl border p-4 text-left transition-all duration-200 hover:shadow-soft ${
                      active ? "border-primary bg-primary-soft shadow-soft" : "hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{e.name}</span>
                      <span
                        className={`flex size-5 items-center justify-center rounded-full border ${
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                      >
                        {active ? <Check className="size-3" /> : null}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.brand} · {e.model}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <StatusBadge tone={e.status as Tone} />
                      <span className="text-sm font-medium">{inr(e.monthlyRate)}/mo</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard step={4} title="Rental details" description="Billing period and dispatch preferences.">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Start date">
                <Input type="date" defaultValue="2026-08-05" className="h-10 rounded-xl" />
              </Field>
              <Field label="Billing cycle">
                <Select defaultValue="monthly">
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Delivery mode">
                <Select defaultValue="home">
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home delivery</SelectItem>
                    <SelectItem value="pickup">Store pickup</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-5 space-y-3">
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  Select equipment above to set rental duration.
                </p>
              ) : (
                lines.map((l) => {
                  const e = equipment.find((x) => x.id === l.id)!;
                  return (
                    <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-medium">{e.name}</p>
                        <p className="text-xs text-muted-foreground">{inr(e.monthlyRate)} / month</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-lg border p-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 rounded-md"
                          onClick={() => setMonths(l.id, -1)}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-14 text-center text-sm">{l.months} mo</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 rounded-md"
                          onClick={() => setMonths(l.id, 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <span className="w-24 text-right text-sm font-medium">{inr(e.monthlyRate * l.months)}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-lg text-danger hover:text-danger"
                        onClick={() => toggleLine(l.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard step={5} title="Charges" description="Discounts, refundable deposit and tax treatment.">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Discount (₹)">
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Refundable deposit (₹)">
                <Input
                  type="number"
                  value={deposit}
                  onChange={(e) => setDeposit(Number(e.target.value) || 0)}
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="GST @ 12%">
                <Select value={gst ? "yes" : "no"} onValueChange={(v) => setGst(v === "yes")}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Apply GST</SelectItem>
                    <SelectItem value="no">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Invoice notes">
                <Textarea
                  placeholder="Delivery instructions, service commitment, payment terms…"
                  className="min-h-24 rounded-xl"
                />
              </Field>
            </div>
          </SectionCard>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-soft lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Invoice summary</h2>
          <p className="text-sm text-muted-foreground">Step 6 · preview before generating</p>
          <Separator className="my-5" />

          <div className="space-y-1">
            <p className="text-sm font-medium">{customer.name}</p>
            <p className="text-xs text-muted-foreground">{customer.address}</p>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2.5">
            {lines.map((l) => {
              const e = equipment.find((x) => x.id === l.id)!;
              return (
                <div key={l.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">{l.months} month(s)</span>
                  </span>
                  <span className="font-medium">{inr(e.monthlyRate * l.months)}</span>
                </div>
              );
            })}
            {lines.length === 0 && <p className="text-sm text-muted-foreground">No equipment selected yet.</p>}
          </div>

          <Separator className="my-4" />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{inr(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="text-danger">−{inr(discount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST (12%)</dt>
              <dd>{inr(tax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Deposit</dt>
              <dd>{inr(deposit)}</dd>
            </div>
          </dl>

          <Separator className="my-4" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Total payable</span>
            <span className="text-2xl font-semibold tracking-tight">{inr(total)}</span>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              className="h-11 rounded-xl"
              disabled={lines.length === 0}
              onClick={() => {
                toast.success("Invoice generated");
                navigate({ to: "/invoices/$invoiceId", params: { invoiceId: "INV-9001" } });
              }}
            >
              <FileCheck2 className="size-4" /> Generate invoice
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => navigate({ to: "/invoices" })}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
