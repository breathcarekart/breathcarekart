import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordPayment } from "@/lib/db/payments";
import { workflowKeys } from "@/lib/db/query-keys";
import type { PaymentMethod } from "@/lib/db/types";
import { inr, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { paymentMethodLabels } from "@/lib/status";

const methods: PaymentMethod[] = ["cash", "upi", "card", "bank_transfer", "cheque", "other"];

/** Records a full or partial payment. The database updates the invoice balance and status. */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  outstanding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  outstanding: number;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : "");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const value = Number(amount);
  const amountError =
    amount === ""
      ? null
      : !(value > 0)
        ? "Enter an amount greater than zero"
        : value > outstanding
          ? `Can't be more than ${inr(outstanding)} outstanding`
          : null;
  const canSave = amount !== "" && !amountError && method !== "" && !!date;

  const save = useMutation({
    mutationFn: () =>
      recordPayment({
        invoiceId,
        amount: value,
        method: method as PaymentMethod,
        paymentDate: date,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all(
        workflowKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      const left = Math.max(0, Math.round((outstanding - value) * 100) / 100);
      notifySuccess(
        `Payment of ${inr(value)} recorded`,
        left > 0
          ? `${inr(left)} still outstanding on ${invoiceNumber}`
          : `${invoiceNumber} is fully paid`,
      );
      onOpenChange(false);
    },
    onError: (error) => notifyError(error, "Couldn't record payment"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setAmount(outstanding > 0 ? String(outstanding) : "");
          setMethod("");
          setDate(todayISO());
          setReference("");
          setNotes("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Wallet className="size-4" />
            </span>
            Record payment
          </DialogTitle>
          <DialogDescription>
            {invoiceNumber} · {inr(outstanding)} outstanding
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 rounded-xl"
                aria-invalid={!!amountError}
              />
              {amountError ? <p className="text-xs text-destructive">{amountError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {paymentMethodLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">Reference</Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="UPI / cheque / receipt no."
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Input
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={!canSave || save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
