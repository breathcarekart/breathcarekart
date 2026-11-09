import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteInvoice } from "@/lib/db/invoices";
import { queryKeys } from "@/lib/db/query-keys";
import { notifyError, notifySuccess } from "@/lib/notify";

type Props = {
  invoice: { id: string; invoice_number: string; amount_paid: number | string };
};

/**
 * The ⋯ menu on an invoice row. Delete asks for confirmation first; the database
 * (delete_invoice) checks the role and refuses invoices with payments recorded.
 */
export function InvoiceRowActions({ invoice }: Props) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const hasPayments = Number(invoice.amount_paid) > 0;

  const remove = useMutation({
    mutationFn: () => deleteInvoice(invoice.id),
    onSuccess: async (res) => {
      setConfirming(false);
      queryClient.removeQueries({ queryKey: queryKeys.invoices.detail(invoice.id) });
      await Promise.all(
        [
          queryKeys.invoices.all,
          queryKeys.rentals.all,
          queryKeys.sales.all,
          queryKeys.customers.all,
          queryKeys.whatsapp.all,
          queryKeys.activity.all,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      notifySuccess("Invoice deleted", `${res.invoice_number} has been deleted.`);
    },
    onError: (error) => notifyError(error, "Couldn't delete the invoice"),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label={`Actions for invoice ${invoice.invoice_number}`}
            disabled={remove.isPending}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            className="text-danger focus:text-danger"
            disabled={hasPayments}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" /> Delete invoice
          </DropdownMenuItem>
          {hasPayments && (
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Has payments recorded, so it can't be deleted.
            </DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !remove.isPending && setConfirming(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {invoice.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Are you sure you want to delete this invoice?</p>
                <p>
                  The invoice, its line items and its WhatsApp message history are removed. The
                  customer, rental or sale and any payments are not affected. This can't be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault(); // stay open until the delete finishes
                remove.mutate();
              }}
            >
              {remove.isPending && <Loader2 className="size-4 animate-spin" />}
              Delete invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
