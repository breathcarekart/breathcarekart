import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, FileText, Pencil, Repeat, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { EmptyState } from "@/components/shared/empty-state";
import { equipment, inr, rentals } from "@/lib/data";

export const Route = createFileRoute("/_app/inventory/$equipmentId")({
  loader: ({ params }) => {
    const item = equipment.find((e) => e.id === params.equipmentId);
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Equipment unavailable · Breath Care Kart" }, { name: "robots", content: "noindex" }] };
    }
    const t = `${loaderData.item.name} · Equipment · Breath Care Kart`;
    const d = `${loaderData.item.brand} ${loaderData.item.model} — status, service history and rental record.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: EquipmentDetailsPage,
});

function EquipmentDetailsPage() {
  const { item } = Route.useLoaderData();
  const history = rentals.filter((r) => r.equipmentId === item.id);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
        <Link to="/inventory">
          <ArrowLeft className="size-4" /> Inventory
        </Link>
      </Button>

      <PageHeader
        title={item.name}
        description={`${item.brand} · ${item.model} · ${item.id}`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl">
              <Wrench className="size-4" /> Send to service
            </Button>
            <Button variant="outline" className="rounded-xl">
              <Pencil className="size-4" /> Edit
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/invoices/new">
                <Repeat className="size-4" /> Start rental
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="mt-1">
            <StatusBadge tone={item.status as Tone} />
          </div>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Monthly rate</p>
          <p className="text-xl font-semibold">{inr(item.monthlyRate)}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Daily rate</p>
          <p className="text-xl font-semibold">{inr(item.dailyRate)}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">In fleet since</p>
          <p className="text-xl font-semibold">{item.purchaseDate}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="gap-0 p-6 shadow-xs">
          <Tabs defaultValue="rentals">
            <TabsList className="rounded-xl">
              <TabsTrigger value="rentals" className="rounded-lg">
                Rental history
              </TabsTrigger>
              <TabsTrigger value="service" className="rounded-lg">
                Service log
              </TabsTrigger>
              <TabsTrigger value="specs" className="rounded-lg">
                Specifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rentals" className="mt-5">
              {history.length === 0 ? (
                <EmptyState
                  icon={Repeat}
                  title="No rentals yet"
                  description="This unit hasn't been rented out. It will appear here after its first dispatch."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Customer</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((r) => (
                      <TableRow key={r.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium">{r.customer}</TableCell>
                        <TableCell className="text-muted-foreground">{r.startDate}</TableCell>
                        <TableCell className="text-muted-foreground">{r.dueDate}</TableCell>
                        <TableCell className="text-right font-medium">{inr(r.rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="service" className="mt-5">
              <ol className="space-y-5">
                {[
                  { title: "Preventive service completed", meta: "Filters replaced, flow calibrated", date: "12 Jun 2026" },
                  { title: "Returned from rental", meta: "Sanitised and repacked", date: "30 May 2026" },
                  { title: "Added to fleet", meta: `Purchased on ${item.purchaseDate}`, date: item.purchaseDate },
                ].map((s, i, arr) => (
                  <li key={s.title} className="relative flex gap-3">
                    {i !== arr.length - 1 && <span className="absolute left-[15px] top-9 h-full w-px bg-border" />}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <CalendarClock className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.meta}</p>
                      <p className="text-xs text-muted-foreground/70">{s.date}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </TabsContent>

            <TabsContent value="specs" className="mt-5">
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {[
                  ["Type", item.type],
                  ["Brand", item.brand],
                  ["Model", item.model],
                  ["Serial number", item.serial],
                  ["Asset ID", item.id],
                  ["Purchase date", item.purchaseDate],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-1 text-sm font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {item.notes ? (
                <>
                  <Separator className="my-5" />
                  <p className="text-sm text-muted-foreground">{item.notes}</p>
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="h-fit gap-0 p-6 shadow-xs">
          <h2 className="text-base font-semibold">Linked invoices</h2>
          <p className="text-sm text-muted-foreground">Billing documents that include this unit.</p>
          <Separator className="my-4" />
          <div className="space-y-3">
            {["BCK/2026/0091", "BCK/2026/0084", "BCK/2026/0072"].map((n) => (
              <div key={n} className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <FileText className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{n}</span>
                </div>
                <span className="text-sm text-muted-foreground">{inr(item.monthlyRate)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
