import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  Download,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { equipment, equipmentTypes, inr, statusCount } from "@/lib/data";

export const Route = createFileRoute("/_app/inventory/")({
  head: () => ({
    meta: [
      { title: "Inventory · Breath Care Kart" },
      {
        name: "description",
        content:
          "Track every oxygen concentrator, BiPAP, hospital bed and monitor with live status, serial numbers and rental rates.",
      },
      { property: "og:title", content: "Inventory · Breath Care Kart" },
      { property: "og:description", content: "Live medical equipment fleet with status, serials and rental rates." },
    ],
  }),
  component: InventoryPage,
});

const PAGE_SIZE = 8;

function InventoryPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      equipment.filter((e) => {
        const q = query.toLowerCase();
        const matchQ =
          !q ||
          [e.name, e.brand, e.model, e.serial, e.id].some((v) => v.toLowerCase().includes(q));
        return matchQ && (status === "all" || e.status === status) && (type === "all" || e.type === type);
      }),
    [query, status, type],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const toggleAll = () =>
    setSelected(allChecked ? [] : rows.map((r) => r.id));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${equipment.length} assets · ${statusCount("available")} available · ${statusCount("rented")} on rent`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.info("Import sheet ready to upload")}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Inventory exported as CSV")}>
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
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, brand, model or serial"
              className="h-10 rounded-xl pl-9"
            />
          </div>

          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-10 w-40 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="rented">Rented</SelectItem>
              <SelectItem value="service">In service</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="h-10 w-48 rounded-xl">
              <SelectValue placeholder="Equipment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {equipmentTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-y bg-primary-soft px-4 py-2.5 text-sm">
            <span className="font-medium text-primary">{selected.length} selected</span>
            <Separator orientation="vertical" className="h-5" />
            <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => toast.success("Status updated")}>
              <SlidersHorizontal className="size-3.5" /> Change status
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg text-danger hover:text-danger"
              onClick={() => {
                toast.error(`${selected.length} assets archived`);
                setSelected([]);
              }}
            >
              <Trash2 className="size-3.5" /> Archive
            </Button>
          </div>
        )}

        <Separator />

        {rows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No equipment matches these filters"
            description="Try a different search term, or clear the status and type filters to see the full fleet."
            action={
              <Button
                variant="outline"
                className="mt-2 rounded-xl"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setType("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : view === "table" ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id} className="transition-colors hover:bg-accent/50">
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(e.id)}
                      onCheckedChange={() => toggle(e.id)}
                      aria-label={`Select ${e.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link to="/inventory/$equipmentId" params={{ equipmentId: e.id }} className="group block">
                      <span className="block text-sm font-medium group-hover:text-primary">{e.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.brand} · {e.model} · {e.id}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{e.type}</TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                    {e.serial}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={e.status as Tone} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{inr(e.monthlyRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((e) => (
              <Link
                key={e.id}
                to="/inventory/$equipmentId"
                params={{ equipmentId: e.id }}
                className="card-hover rounded-2xl border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Boxes className="size-5" />
                  </span>
                  <StatusBadge tone={e.status as Tone} />
                </div>
                <p className="mt-3 text-sm font-medium">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {e.brand} · {e.model}
                </p>
                <Separator className="my-3" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{e.serial}</span>
                  <span className="font-medium">{inr(e.monthlyRate)}/mo</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
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
