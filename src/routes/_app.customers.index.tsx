import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { customers, inr } from "@/lib/data";

export const Route = createFileRoute("/_app/customers/")({
  head: () => ({
    meta: [
      { title: "Customers · Breath Care Kart" },
      {
        name: "description",
        content: "Patient and attender records with rental history, contact details and lifetime billing.",
      },
      { property: "og:title", content: "Customers · Breath Care Kart" },
      { property: "og:description", content: "Patient and attender records with rental and billing history." },
    ],
  }),
  component: CustomersPage,
});

const initials = (n: string) =>
  n
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("");

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const cities = Array.from(new Set(customers.map((c) => c.city)));

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        const q = query.toLowerCase();
        const matchQ = !q || [c.name, c.phone, c.id, c.attender].some((v) => v.toLowerCase().includes(q));
        return matchQ && (city === "all" || c.city === city);
      }),
    [query, city],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${customers.length} accounts · ${customers.reduce((s, c) => s + c.rentals, 0)} lifetime rentals`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Customer list exported")}>
              <Download className="size-4" /> Export
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/customers/new">
                <Plus className="size-4" /> Add customer
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.slice(0, 3).map((c) => (
          <Link
            key={c.id}
            to="/customers/$customerId"
            params={{ customerId: c.id }}
            className="card-hover rounded-2xl border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarFallback className="bg-primary-soft text-primary">{initials(c.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.age} yrs · {c.city}
                </p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{c.rentals} rentals</span>
              <span className="font-medium">{inr(c.totalBilled)} billed</span>
            </div>
          </Link>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient, attender or phone"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="h-10 w-44 rounded-xl">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers found"
            description="No patient records match your search. Try another name, phone number or clear the city filter."
            action={
              <Button asChild className="mt-2 rounded-xl">
                <Link to="/customers/new">Add customer</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Patient</TableHead>
                <TableHead className="hidden md:table-cell">Attender</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead>Rentals</TableHead>
                <TableHead className="text-right">Billed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="transition-colors hover:bg-accent/50">
                  <TableCell>
                    <Link to="/customers/$customerId" params={{ customerId: c.id }} className="group flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary-soft text-xs text-primary">
                          {initials(c.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        <span className="block text-sm font-medium group-hover:text-primary">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.gender}, {c.age} · {c.city}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    <span className="block">{c.attender}</span>
                    <span className="block text-xs text-muted-foreground">{c.attenderRelation}</span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{c.phone}</TableCell>
                  <TableCell className="text-sm">{c.rentals}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{inr(c.totalBilled)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
