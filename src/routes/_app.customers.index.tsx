import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { customerQueries, type CustomerListItem } from "@/lib/db/customers";
import { formatDate, inr, initials, phoneDigits } from "@/lib/format";
import { totalPaid } from "@/lib/payments";

export const Route = createFileRoute("/_app/customers/")({
  head: () => ({
    meta: [
      { title: "Customers · Breath Care Kart" },
      {
        name: "description",
        content: "Patients and attenders with their rentals, invoices and balances.",
      },
    ],
  }),
  component: CustomersPage,
});

const billed = (c: CustomerListItem) =>
  c.invoices
    .filter((i) => i.status !== "cancelled" && i.status !== "draft")
    .reduce((s, i) => s + Number(i.grand_total), 0);
/** Paid via invoices or straight against rentals; each payment counted once. */
const paid = (c: CustomerListItem) =>
  totalPaid([
    ...c.invoices.flatMap((i) => i.payments),
    ...c.rental_payments.flatMap((r) => r.payments),
  ]);
const rentalCount = (c: CustomerListItem) => c.rentals[0]?.count ?? 0;

function CustomersPage() {
  const query = useQuery(customerQueries.list());
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");

  const customers = useMemo(() => query.data ?? [], [query.data]);
  const cities = useMemo(
    () =>
      [...new Set(customers.map((c) => c.city).filter((c): c is string => !!c))]
        .sort()
        .map((c) => ({ value: c, label: c })),
    [customers],
  );

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    const digits = phoneDigits(q);
    const matchQ =
      !q ||
      [c.name, c.attender_name, c.city].some((v) => v?.toLowerCase().includes(q)) ||
      (digits.length >= 4 &&
        [c.phone, c.whatsapp].some((p) => p && phoneDigits(p).includes(digits)));
    return matchQ && (city === "all" || c.city === city);
  });

  const exportCsv = () =>
    downloadCsv(
      "customers",
      [
        "Name",
        "Age",
        "Gender",
        "Phone",
        "WhatsApp",
        "Attender",
        "Relation",
        "City",
        "Address",
        "Rentals",
        "Billed",
        "Paid",
        "Customer since",
      ],
      filtered.map((c) => [
        c.name,
        c.age,
        c.gender,
        c.phone,
        c.whatsapp,
        c.attender_name,
        c.attender_relation,
        c.city,
        c.address,
        rentalCount(c),
        billed(c),
        paid(c),
        c.customer_since,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={
          query.data ? `${customers.length} customers` : "Patients, attenders and their history"
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
              <Link to="/customers/new">
                <Plus className="size-4" /> Add customer
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
            placeholder="Search name, attender, city or phone"
          />
          <SelectFilter value={city} onChange={setCity} allLabel="All cities" options={cities} />
        </FilterBar>
        <Separator />
        <QueryState query={query} errorTitle="Couldn't load customers">
          {() =>
            filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Users}
                  title={customers.length === 0 ? "No customers yet" : "No customers match"}
                  description={
                    customers.length === 0
                      ? "Add your first customer to start renting or selling equipment."
                      : "Try another name or phone number, or clear the city filter."
                  }
                  action={
                    <Button asChild className="mt-2 rounded-xl">
                      <Link to="/customers/new">Add customer</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Patient</TableHead>
                    <TableHead className="hidden md:table-cell">Attender</TableHead>
                    <TableHead className="hidden lg:table-cell">Phone</TableHead>
                    <TableHead className="hidden sm:table-cell">Rentals</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="transition-colors hover:bg-accent/50">
                      <TableCell>
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: c.id }}
                          className="group flex items-center gap-3"
                        >
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-primary-soft text-xs text-primary">
                              {initials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium group-hover:text-primary">
                              {c.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {[c.gender, c.age != null ? `${c.age} yrs` : null, c.city]
                                .filter(Boolean)
                                .join(" · ") || `Since ${formatDate(c.customer_since)}`}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        <span className="block">{c.attender_name ?? "—"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.attender_relation}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {c.phone ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">
                        {rentalCount(c)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {inr(billed(c))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-success">
                        {inr(paid(c))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
