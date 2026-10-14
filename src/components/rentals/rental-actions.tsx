import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { workflowKeys } from "@/lib/db/query-keys";
import { renewRental, returnRental } from "@/lib/db/rentals";
import { addMonthsISO, formatDate, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";

export type RentalRef = { id: string; rental_number: string; start_date: string; due_date: string };

function useWorkflowRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(workflowKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Closes a rental: rental → Returned, its equipment → Available (one server transaction). */
export function ReturnRentalDialog({
  rental,
  onClose,
}: {
  rental: RentalRef | null;
  onClose: () => void;
}) {
  const refresh = useWorkflowRefresh();
  const [date, setDate] = useState(todayISO());
  const save = useMutation({
    mutationFn: () => returnRental(rental!.id, date),
    onSuccess: async () => {
      await refresh();
      notifySuccess(`${rental!.rental_number} returned`, "Equipment is available again.");
      onClose();
    },
    onError: (error) => notifyError(error, "Couldn't close the rental"),
  });

  return (
    <Dialog open={rental !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Return {rental?.rental_number}</DialogTitle>
          <DialogDescription>
            Marks the rental returned and makes its equipment available again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="return-date">Returned on</Label>
          <Input
            id="return-date"
            type="date"
            value={date}
            min={rental?.start_date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-xl"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!date || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Confirm return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Extends a rental's end date. Billing for the extra period is a separate invoice. */
export function RenewRentalDialog({
  rental,
  onClose,
}: {
  rental: RentalRef | null;
  onClose: () => void;
}) {
  const refresh = useWorkflowRefresh();
  const [date, setDate] = useState("");
  const value = date || (rental ? addMonthsISO(rental.due_date, 1) : "");
  const save = useMutation({
    mutationFn: () => renewRental(rental!.id, value),
    onSuccess: async () => {
      await refresh();
      notifySuccess(`${rental!.rental_number} renewed`, `New end date ${formatDate(value)}.`);
      setDate("");
      onClose();
    },
    onError: (error) => notifyError(error, "Couldn't renew the rental"),
  });

  return (
    <Dialog
      open={rental !== null}
      onOpenChange={(o) => {
        if (!o) {
          setDate("");
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Renew {rental?.rental_number}</DialogTitle>
          <DialogDescription>
            Currently ends {rental ? formatDate(rental.due_date) : ""}. Create an invoice for the
            extra period separately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="renew-date">New end date</Label>
          <Input
            id="renew-date"
            type="date"
            value={value}
            min={rental?.due_date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-xl"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!value || (rental ? value <= rental.due_date : true) || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Renew
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
