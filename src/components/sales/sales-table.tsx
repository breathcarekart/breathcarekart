import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SaleWithRelations } from "@/lib/db/sales";
import { formatDate, inr } from "@/lib/format";
import { roleLabel, toRole } from "@/lib/roles";
import { saleAmount, saleInvoice, saleStatus } from "@/lib/sales";

/** Sales table shared by the Sales and Sales Logs screens. */
export function SalesTable({ rows }: { rows: SaleWithRelations[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Sale ID</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead className="hidden md:table-cell">Equipment</TableHead>
          <TableHead className="hidden lg:table-cell">Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="hidden xl:table-cell">Created by</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12 text-right">
            <span className="sr-only">Invoice</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => {
          const inv = saleInvoice(s);
          const status = saleStatus(s);
          const items = s.sale_items.map((i) => i.description).join(", ");
          return (
            <TableRow key={s.id} className="transition-colors hover:bg-accent/50">
              <TableCell className="font-mono text-xs font-medium">{s.sale_number}</TableCell>
              <TableCell>
                <Link
                  to="/customers/$customerId"
                  params={{ customerId: s.customer_id }}
                  className="block text-sm font-medium hover:text-primary"
                >
                  {s.customer?.name}
                </Link>
                <span className="block text-xs text-muted-foreground md:hidden">{items}</span>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {items}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {formatDate(s.sale_date)}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">{inr(saleAmount(s))}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                {s.creator
                  ? `${s.creator.full_name ?? "—"} — ${roleLabel(toRole(s.creator.role))}`
                  : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge tone={status.tone} label={status.label} />
              </TableCell>
              <TableCell className="text-right">
                {inv ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    aria-label={`Open invoice for ${s.sale_number}`}
                  >
                    <Link to="/invoices/$invoiceId" params={{ invoiceId: inv.id }}>
                      <FileText className="size-4" />
                    </Link>
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
