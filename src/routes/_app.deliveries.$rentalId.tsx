import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Truck,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  RenewRentalDialog,
  ReturnRentalDialog,
  type RentalRef,
} from "@/components/rentals/rental-actions";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { deliveryPhotoUrl, uploadDeliveryPhoto } from "@/lib/db/deliveries";
import { profileQueries } from "@/lib/db/profiles";
import { queryKeys, workflowKeys } from "@/lib/db/query-keys";
import {
  assignSupervisor,
  rentalQueries,
  setDeliveryStatus,
  type fetchRental,
} from "@/lib/db/rentals";
import { formatDate, formatDateTime, inr } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { totalPaid } from "@/lib/payments";
import { isOfficeRole, useCurrentUser } from "@/lib/roles";
import {
  asDeliveryStatus,
  deliveryStatusLabels,
  deliveryStatusTone,
  isOpenRental,
  outstandingOf,
  paymentMethodLabels,
  paymentState,
  paymentStateLabels,
  paymentStateTone,
  rentalStage,
  rentalStageLabels,
  rentalStageTone,
} from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/deliveries/$rentalId")({
  head: () => ({
    meta: [
      { title: "Rental & delivery · Breath Care Kart" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveryPage,
});

type RentalDetail = Awaited<ReturnType<typeof fetchRental>>;

const steps = [
  { value: "assigned", label: "Assigned" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
] as const;

function DeliveryPage() {
  const { rentalId } = Route.useParams();
  const { role } = useCurrentUser();
  const query = useQuery(rentalQueries.detail(rentalId));
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
        <Link to={role === "supervisor" ? "/dashboard" : "/inventory/rental-logs"}>
          <ArrowLeft className="size-4" /> {role === "supervisor" ? "My rentals" : "Rental logs"}
        </Link>
      </Button>
      <QueryState query={query} loading={<CardsSkeleton />} errorTitle="Couldn't load this rental">
        {(rental) => <Delivery rental={rental} />}
      </QueryState>
    </div>
  );
}

function Delivery({ rental }: { rental: RentalDetail }) {
  const queryClient = useQueryClient();
  const { role, profile } = useCurrentUser();
  const office = isOfficeRole(role);
  const staff = useQuery({ ...profileQueries.list(), enabled: office });
  const [notes, setNotes] = useState(rental.delivery_notes ?? "");
  const [viewing, setViewing] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<RentalRef | null>(null);
  const [returning, setReturning] = useState<RentalRef | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const delivery = asDeliveryStatus(rental.delivery_status);
  const stage = rentalStage(rental);
  const open = isOpenRental(rental);
  const canUpdate =
    open && delivery !== "delivered" && (office || rental.supervisor_id === profile.id);
  const photos = rental.delivery_photos;
  const stepIndex = delivery === "pending" ? -1 : steps.findIndex((s) => s.value === delivery);
  const supervisors = (staff.data ?? []).filter((p) => p.role === "supervisor" && p.is_active);
  const customer = rental.customer;

  const refresh = () =>
    Promise.all(workflowKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  const assign = useMutation({
    mutationFn: (supervisorId: string) => assignSupervisor(rental.id, supervisorId),
    onSuccess: async () => {
      await refresh();
      notifySuccess("Supervisor assigned");
    },
    onError: (error) => notifyError(error, "Couldn't assign supervisor"),
  });

  const setStatus = useMutation({
    mutationFn: (status: "out_for_delivery" | "delivered") =>
      setDeliveryStatus(rental.id, status, notes.trim() || undefined),
    onSuccess: async (_, status) => {
      await refresh();
      notifySuccess(
        status === "delivered" ? "Delivery confirmed" : "Marked out for delivery",
        rental.rental_number,
      );
    },
    onError: (error) => notifyError(error, "Couldn't update delivery"),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadDeliveryPhoto(rental.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rentals.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });
      notifySuccess("Delivery photo uploaded");
    },
    onError: (error) => notifyError(error, "Photo not uploaded"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${rental.rental_number} · ${customer?.name ?? "Rental"}`}
        description={`${rental.rental_items.map((i) => i.equipment_type?.name ?? i.description).join(", ")} · ${formatDate(rental.start_date)} → ${formatDate(rental.returned_date ?? rental.due_date)}`}
        actions={
          <>
            <StatusBadge
              tone={rentalStageTone[stage]}
              label={rentalStageLabels[stage]}
              className="text-sm"
            />
            {office && open && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setRenewing(rental)}
                >
                  Renew
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setReturning(rental)}
                >
                  Return
                </Button>
              </>
            )}
          </>
        }
      />

      <Card className="gap-0 p-5 shadow-xs">
        <ol className="grid grid-cols-3 gap-2">
          {steps.map((s, i) => {
            const done = i < stepIndex || delivery === "delivered";
            const current = i === stepIndex && delivery !== "delivered";
            return (
              <li key={s.value} className="flex flex-col items-center gap-2 text-center">
                <div className="flex w-full items-center">
                  <span
                    className={cn(
                      "h-px flex-1",
                      i === 0 ? "bg-transparent" : i <= stepIndex ? "bg-primary" : "bg-border",
                    )}
                  />
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && "border-primary bg-primary-soft text-primary",
                      !done && !current && "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "h-px flex-1",
                      i === steps.length - 1
                        ? "bg-transparent"
                        : i < stepIndex
                          ? "bg-primary"
                          : "bg-border",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium sm:text-sm",
                    done || current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
        {delivery === "pending" && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Waiting for a supervisor to be assigned.
          </p>
        )}
        {rental.delivered_at && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Delivered {formatDateTime(rental.delivered_at)}
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Customer &amp; address</h2>
            <Separator className="my-5" />
            <dl className="grid gap-5 sm:grid-cols-2">
              <InfoRow
                icon={UserRound}
                label="Customer"
                value={customer?.name ?? "—"}
                sub={
                  customer?.attender_name
                    ? `Attender: ${customer.attender_name}${customer.attender_relation ? ` (${customer.attender_relation})` : ""}`
                    : undefined
                }
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={
                  customer?.phone ? (
                    <a
                      href={`tel:${customer.phone.replace(/\s/g, "")}`}
                      className="hover:text-primary"
                    >
                      {customer.phone}
                    </a>
                  ) : (
                    "Not on file"
                  )
                }
              />
              <div className="sm:col-span-2">
                <InfoRow
                  icon={MapPin}
                  label="Delivery address"
                  value={
                    [customer?.address, customer?.city].filter(Boolean).join(", ") || "Not on file"
                  }
                />
              </div>
            </dl>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Equipment &amp; rental</h2>
            <Separator className="my-5" />
            <ul className="space-y-2">
              {rental.rental_items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {it.description ?? it.equipment_type?.name}
                    </span>
                    {it.equipment_unit?.serial_number ? (
                      <span className="block text-xs text-muted-foreground">
                        S/N {it.equipment_unit.serial_number}
                      </span>
                    ) : null}
                  </span>
                  {office && it.rate != null ? (
                    <span className="font-medium">{inr(it.rate)}/mo</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Detail
                label="Rental period"
                value={`${formatDate(rental.start_date)} → ${formatDate(rental.due_date)}`}
              />
              {rental.returned_date ? (
                <Detail label="Returned" value={formatDate(rental.returned_date)} />
              ) : null}
              {office ? (
                <Detail label="Refundable deposit" value={inr(rental.deposit_amount)} />
              ) : null}
              <Detail label="Created by" value={rental.creator?.full_name ?? "—"} />
            </dl>
            {office && rental.invoices.length > 0 && (
              <>
                <Separator className="my-5" />
                <h3 className="mb-2 text-sm font-semibold">Invoices</h3>
                <ul className="space-y-2">
                  {rental.invoices.map((inv) => {
                    const st = paymentState(inv);
                    return (
                      <li key={inv.id}>
                        <Link
                          to="/invoices/$invoiceId"
                          params={{ invoiceId: inv.id }}
                          className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm hover:bg-accent/50"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <FileText className="size-4 text-primary" /> {inv.invoice_number}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {inr(outstandingOf(inv))} due
                            </span>
                            <StatusBadge
                              tone={paymentStateTone[st]}
                              label={paymentStateLabels[st]}
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {/* Office roles only; the database also returns no payments to supervisors. */}
            {office && <RentalPayments payments={rental.payments} />}
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Delivery confirmation</h2>
            <p className="text-sm text-muted-foreground">
              Photo of the installed equipment, then confirm delivery.
            </p>
            <Separator className="my-5" />

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Upload delivery photo"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = "";
              }}
            />

            {photos.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" /> Delivery Photo Uploaded
                </p>
                <ul className="space-y-2">
                  {photos.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {p.uploader?.full_name ?? "Staff"} · {formatDateTime(p.created_at)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => setViewing(p.storage_path)}
                      >
                        <ImageIcon className="size-4" /> View Photo
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canUpdate && delivery !== "pending" && (
              <button
                type="button"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-7 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/40 disabled:opacity-60"
              >
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  {upload.isPending ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Camera className="size-5" />
                  )}
                </span>
                <span className="text-sm font-medium">
                  {upload.isPending
                    ? "Uploading…"
                    : photos.length
                      ? "Add another photo"
                      : "Upload Delivery Photo"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Take a photo or choose one · up to 10 MB
                </span>
              </button>
            )}
            {!canUpdate && photos.length === 0 && (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No delivery photo yet.
              </p>
            )}

            {canUpdate && delivery !== "pending" && (
              <>
                <div className="mt-5 space-y-2">
                  <Label htmlFor="delivery-notes">Delivery notes</Label>
                  <Textarea
                    id="delivery-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Installed in bedroom, demo given to attender, received by…"
                    className="min-h-24 rounded-xl"
                  />
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {delivery === "assigned" && (
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate("out_for_delivery")}
                    >
                      <Truck className="size-4" /> Mark out for delivery
                    </Button>
                  )}
                  <Button
                    className="rounded-xl"
                    disabled={photos.length === 0 || setStatus.isPending}
                    onClick={() => setStatus.mutate("delivered")}
                  >
                    {setStatus.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ClipboardCheck className="size-4" />
                    )}{" "}
                    Confirm Delivery
                  </Button>
                </div>
                {photos.length === 0 && (
                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    Upload a delivery photo to confirm.
                  </p>
                )}
              </>
            )}
            {rental.delivery_notes && !canUpdate ? (
              <p className="mt-4 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm">
                {rental.delivery_notes}
              </p>
            ) : null}
          </Card>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-xs lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Assigned supervisor</h2>
          <Separator className="my-5" />
          {rental.supervisor ? (
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-warning-soft text-warning-foreground">
                <Truck className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {rental.supervisor.full_name ?? rental.supervisor.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supervisor{rental.supervisor.phone ? ` · ${rental.supervisor.phone}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not assigned yet.</p>
          )}
          {office && open && delivery !== "delivered" && (
            <div className="mt-4 space-y-2">
              <Label className="text-xs text-muted-foreground">
                {rental.supervisor ? "Reassign" : "Assign"}
              </Label>
              <Select
                value={rental.supervisor_id ?? ""}
                onValueChange={(v) => assign.mutate(v)}
                disabled={assign.isPending}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue
                    placeholder={supervisors.length ? "Choose supervisor" : "No active supervisors"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name ?? s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Separator className="my-5" />
          <h3 className="text-sm font-semibold">Delivery status</h3>
          <div className="mt-2">
            <StatusBadge
              tone={deliveryStatusTone[delivery]}
              label={deliveryStatusLabels[delivery]}
            />
          </div>
        </Card>
      </div>

      <PhotoDialog path={viewing} onClose={() => setViewing(null)} title={rental.rental_number} />
      <RenewRentalDialog rental={renewing} onClose={() => setRenewing(null)} />
      <ReturnRentalDialog rental={returning} onClose={() => setReturning(null)} />
    </div>
  );
}

/** Private photo shown through a short-lived signed URL. */
function PhotoDialog({
  path,
  onClose,
  title,
}: {
  path: string | null;
  onClose: () => void;
  title: string;
}) {
  const url = useQuery({
    queryKey: ["delivery-photo-url", path],
    queryFn: () => deliveryPhotoUrl(path!),
    enabled: !!path,
    staleTime: 5 * 60_000,
  });
  return (
    <Dialog open={!!path} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delivery photo · {title}</DialogTitle>
          <DialogDescription>Stored privately; this link expires in 10 minutes.</DialogDescription>
        </DialogHeader>
        {url.isPending ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : url.isError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            The photo couldn&apos;t be loaded.
          </p>
        ) : (
          <img
            src={url.data}
            alt="Delivery photo"
            className="max-h-[70vh] w-full rounded-xl object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Phone;
  label: string;
  value: React.ReactNode;
  sub?: string | undefined;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium leading-snug">{value}</dd>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function RentalPayments({ payments }: { payments: RentalDetail["payments"] }) {
  const sorted = [...payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  return (
    <>
      <Separator className="my-5" />
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Payments</h3>
        <span className="text-sm">
          <span className="text-muted-foreground">Total paid </span>
          <span className="font-semibold text-success">{inr(totalPaid(payments))}</span>
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded for this rental.</p>
      ) : (
        <ul className="divide-y rounded-xl border text-sm">
          {sorted.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block font-medium">
                  {p.period_start && p.period_end
                    ? `${formatDate(p.period_start)} → ${formatDate(p.period_end)}`
                    : formatDate(p.payment_date)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Paid {formatDate(p.payment_date)} · {paymentMethodLabels[p.method]}
                  {p.invoice_id ? " · invoice" : ""}
                </span>
              </span>
              <span className="shrink-0 font-medium text-success">{inr(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
