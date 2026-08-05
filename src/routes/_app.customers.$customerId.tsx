import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileText, MapPin, MessageCircle, Phone, Plus, Repeat, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { customers, inr, invoices, rentals } from "@/lib/data";

export const Route = createFileRoute("/_app/customers/$customerId")({
  loader: ({ params }) => {
    const customer = customers.find((c) => c.id === params.customerId);
    if (!customer) throw notFound();
    return { customer };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Customer unavailable · Breath Care Kart" }, { name: "robots", content: "noindex" }] };
    }
    const t = `${loaderData.customer.name} · Customer · Breath Care Kart`;
    const d = `Rental history, invoices and current equipment for ${loaderData.customer.name}, ${loaderData.customer.city}.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: CustomerProfilePage,
});

function CustomerProfilePage() {
  const { customer } = Route.useLoaderData();
  const custRentals = rentals.filter((r) => r.customerId === customer.id);
  const custInvoices = invoices.filter((i) => i.customerId === customer.id);
  const initials = customer.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
        <Link to="/customers">
          <ArrowLeft className="size-4" /> Customers
        </Link>
      </Button>

      <Card className="gap-0 p-6 shadow-xs">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary-soft text-lg text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">
                {customer.gender}, {customer.age} yrs · {customer.id} · customer since {customer.since}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl">
              <MessageCircle className="size-4" /> WhatsApp
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/invoices/new">
                <Plus className="size-4" /> New invoice
              </Link>
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Phone, label: "Phone", value: customer.phone },
            { icon: MessageCircle, label: "WhatsApp", value: customer.whatsapp },
            { icon: ShieldAlert, label: "Emergency", value: customer.emergency },
            { icon: MapPin, label: "Address", value: customer.address },
          ].map((f) => (
            <div key={f.label} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <f.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-medium leading-snug">{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Lifetime rentals</p>
          <p className="text-2xl font-semibold">{customer.rentals}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Total billed</p>
          <p className="text-2xl font-semibold">{inr(customer.totalBilled)}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Attender</p>
          <p className="text-lg font-semibold">{customer.attender}</p>
          <p className="text-xs text-muted-foreground">{customer.attenderRelation}</p>
        </Card>
      </div>

      <Card className="gap-0 p-6 shadow-xs">
        <Tabs defaultValue="equipment">
          <TabsList className="rounded-xl">
            <TabsTrigger value="equipment" className="rounded-lg">
              Current equipment
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg">
              Invoices
            </TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-lg">
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipment" className="mt-5">
            {custRentals.length === 0 ? (
              <EmptyState
                icon={Repeat}
                title="No equipment on rent"
                description="This customer has no active rentals. Create an invoice to dispatch equipment."
                action={
                  <Button asChild className="mt-2 rounded-xl">
                    <Link to="/invoices/new">Create invoice</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {custRentals.map((r) => (
                  <div key={r.id} className="card-hover rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{r.equipment}</p>
                      <StatusBadge tone={r.status as Tone} />
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {r.startDate} → {r.dueDate}
                      </span>
                      <span className="font-medium text-foreground">{inr(r.rate)}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-5">
            {custInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Invoices generated for this customer will be listed here with payment status."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium">
                        <Link to="/invoices/$invoiceId" params={{ invoiceId: inv.id }} className="hover:text-primary">
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.period}</TableCell>
                      <TableCell>
                        <StatusBadge tone={inv.status as Tone} />
                      </TableCell>
                      <TableCell className="text-right font-medium">{inr(inv.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-5">
            <ol className="space-y-5">
              {[
                { t: "Invoice generated", m: custInvoices[0]?.number ?? "—", d: "01 Jul 2026" },
                { t: "Equipment delivered", m: custRentals[0]?.equipment ?? "—", d: "01 Jul 2026" },
                { t: "Rental agreement signed", m: "30-day cycle, auto-renew", d: "30 Jun 2026" },
                { t: "Customer onboarded", m: `${customer.city} · ${customer.phone}`, d: customer.since },
              ].map((e, i, arr) => (
                <li key={e.t} className="relative flex gap-3">
                  {i !== arr.length - 1 && <span className="absolute left-[15px] top-9 h-full w-px bg-border" />}
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Repeat className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{e.t}</p>
                    <p className="text-xs text-muted-foreground">{e.m}</p>
                    <p className="text-xs text-muted-foreground/70">{e.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
