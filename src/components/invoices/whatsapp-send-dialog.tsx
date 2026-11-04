import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  FlaskConical,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { PreviewNotice } from "@/components/shared/preview-notice";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";
import { inr } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  isWhatsAppConfigured,
  sendInvoiceWhatsApp,
  whatsAppChatLink,
  whatsAppQueries,
} from "@/lib/whatsapp";
import {
  ACCEPTED_NOTE,
  createSendGuard,
  DEFAULT_SEND_MODE,
  describeSendError,
  inFlightPhase,
  isOutcomeUnknown,
  maskCustomerPhone,
  modeOptions,
  needsResendConfirmation,
  phaseLabels,
  phaseTones,
  resultPhase,
  type SendPhase,
  type WhatsAppPreview,
  type WhatsAppSendMode,
  type WhatsAppSendResult,
} from "@/lib/whatsapp-ui";

const errorCodeOf = (error: unknown) => (error instanceof DataError && error.code) || "unexpected";

/**
 * Sends an invoice on WhatsApp through the server-side integration, after a review and
 * confirmation step. Offers a dry run (default, sends nothing) and a test send to the
 * internal number. Never offers a live send to the customer.
 */
export function WhatsAppSendDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  invoiceStatus,
  total,
  customerName,
  phone,
  pdfFilename,
  companyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  total: number;
  customerName: string;
  phone: string | null;
  pdfFilename: string;
  companyName: string;
}) {
  const configured = isWhatsAppConfigured();
  const sendable = invoiceStatus !== "draft" && invoiceStatus !== "cancelled";
  const queryClient = useQueryClient();
  const guard = useRef(createSendGuard());
  const [mode, setMode] = useState<WhatsAppSendMode>(DEFAULT_SEND_MODE);
  const [phase, setPhase] = useState<SendPhase>("ready");
  const [result, setResult] = useState<WhatsAppSendResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resendConfirmed, setResendConfirmed] = useState(false);
  // A test send whose outcome is unknown (timeout, lost connection) may have reached the
  // test number. Kept while this page is open, so switching modes or reopening the
  // dialog doesn't drop the confirmation step; cleared by the next accepted send.
  const [testOutcomeUnknown, setTestOutcomeUnknown] = useState(false);

  const preview = useQuery({
    ...whatsAppQueries.preview(invoiceId),
    enabled: open && configured && sendable,
  });

  const send = useMutation({
    mutationFn: (v: { mode: WhatsAppSendMode; confirmResend: boolean }) =>
      sendInvoiceWhatsApp(invoiceId, v.mode, v.confirmResend),
    onMutate: (v) => {
      setPhase(inFlightPhase(v.mode));
      setResult(null);
      setErrorCode(null);
    },
    onSuccess: (r) => {
      setPhase(resultPhase(r));
      setResult(r);
      setResendConfirmed(false);
      if (r.status === "accepted") setTestOutcomeUnknown(false);
      notifySuccess(
        r.status === "dry_run" ? "Dry run completed — nothing was sent" : "Accepted by AiSensy",
        r.status === "dry_run" ? invoiceNumber : "Test send. Not a delivery confirmation.",
      );
    },
    onError: (error, v) => {
      const code = errorCodeOf(error);
      setPhase("failed");
      setErrorCode(code);
      setResendConfirmed(false);
      if (v.mode === "test" && isOutcomeUnknown(code)) setTestOutcomeUnknown(true);
    },
    onSettled: () => {
      guard.current.finish();
      // Every attempt is logged on the server, successful or not.
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.history(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.preview(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });
    },
  });

  const reset = () => {
    setMode(DEFAULT_SEND_MODE);
    setPhase("ready");
    setResult(null);
    setErrorCode(null);
    setResendConfirmed(false);
  };

  // Start fresh (dry run, Ready) every time the page opens the dialog.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset();
  }

  const needsConfirm =
    needsResendConfirmation(mode, preview.data, errorCode) ||
    (mode === "test" && testOutcomeUnknown);

  const submit = () => {
    if (needsConfirm && !resendConfirmed) return;
    if (!guard.current.tryStart()) return;
    send.mutate({ mode, confirmResend: needsConfirm && resendConfirmed });
  };

  const fallbackMessage = `Your invoice ${invoiceNumber} from ${companyName} is ready.`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Keep the dialog open while a request is running, so its result isn't lost.
        if (!next && send.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <WhatsAppSendPanel
          configured={configured}
          sendable={sendable}
          invoiceStatus={invoiceStatus}
          customerName={preview.data?.recipient.name ?? customerName}
          phoneMasked={preview.data?.recipient.phone_masked ?? maskCustomerPhone(phone)}
          invoiceNumber={invoiceNumber}
          totalText={inr(total)}
          pdfFilename={preview.data?.attachment_filename ?? pdfFilename}
          preview={preview.data ?? null}
          previewLoading={preview.isFetching && !preview.data}
          previewErrorCode={preview.error ? errorCodeOf(preview.error) : null}
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            setPhase("ready");
            setResult(null);
            setErrorCode(null);
            setResendConfirmed(false);
          }}
          phase={phase}
          pending={send.isPending}
          result={result}
          errorCode={errorCode}
          needsConfirm={needsConfirm}
          resendConfirmed={resendConfirmed}
          onResendConfirmedChange={setResendConfirmed}
          onSubmit={submit}
          onRefresh={() => {
            setPhase("ready");
            setErrorCode(null);
            void preview.refetch();
            void queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.history(invoiceId) });
          }}
          onClose={() => onOpenChange(false)}
          chatLink={phone ? whatsAppChatLink(phone, fallbackMessage) : null}
        />
      </DialogContent>
    </Dialog>
  );
}

export type WhatsAppSendPanelProps = {
  configured: boolean;
  sendable: boolean;
  invoiceStatus: string;
  customerName: string;
  phoneMasked: string | null;
  invoiceNumber: string;
  totalText: string;
  pdfFilename: string;
  preview: WhatsAppPreview | null;
  previewLoading: boolean;
  previewErrorCode: string | null;
  mode: WhatsAppSendMode;
  onModeChange: (mode: WhatsAppSendMode) => void;
  phase: SendPhase;
  pending: boolean;
  result: WhatsAppSendResult | null;
  errorCode: string | null;
  needsConfirm: boolean;
  resendConfirmed: boolean;
  onResendConfirmedChange: (confirmed: boolean) => void;
  onSubmit: () => void;
  onRefresh: () => void;
  onClose: () => void;
  chatLink: string | null;
};

/** The dialog's contents, driven only by props (no data fetching). */
export function WhatsAppSendPanel(p: WhatsAppSendPanelProps) {
  const options = modeOptions(p.preview);
  const selected = options.find((o) => o.mode === p.mode);
  const error = p.errorCode ? describeSendError(p.errorCode) : null;
  const previewError = p.previewErrorCode ? describeSendError(p.previewErrorCode) : null;
  const ready = p.configured && p.sendable && !!p.preview && !previewError;
  const blocked =
    !ready ||
    !selected?.available ||
    p.pending ||
    (p.needsConfirm && !p.resendConfirmed) ||
    (error != null && (error.retry === "none" || error.retry === "wait"));

  const actionLabel =
    p.mode === "dry_run"
      ? "Run dry run"
      : p.needsConfirm
        ? "Send Again"
        : error?.retry === "retry"
          ? "Try again"
          : "Send test";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-success-soft text-success">
            <MessageCircle className="size-4" />
          </span>
          Send invoice via WhatsApp
        </DialogTitle>
        <DialogDescription>Check the details, choose how to send, then confirm.</DialogDescription>
      </DialogHeader>

      <dl className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
        <Field label="Customer" value={p.customerName} />
        <Field label="WhatsApp number" value={p.phoneMasked ?? "No number on file"} />
        <Field label="Invoice" value={p.invoiceNumber} />
        <Field label="Total" value={p.totalText} />
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Attachment</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-medium">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{p.pdfFilename}</span>
          </dd>
        </div>
      </dl>

      {!p.configured ? (
        <PreviewNotice>
          WhatsApp sending isn't switched on for this environment, so nothing will be sent from
          here. You can open a chat and send the invoice yourself.
        </PreviewNotice>
      ) : !p.sendable ? (
        <Notice tone="warning">
          A {p.invoiceStatus} invoice can't be sent. Issue the invoice first.
        </Notice>
      ) : p.previewLoading ? (
        <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking the invoice and send options…
        </p>
      ) : previewError ? (
        <Notice tone="danger">{previewError.message}</Notice>
      ) : p.preview ? (
        <>
          <fieldset className="space-y-2" disabled={p.pending}>
            <legend className="mb-2 text-sm font-medium">How to send</legend>
            <RadioGroup
              value={p.mode}
              onValueChange={(v) => p.onModeChange(v as WhatsAppSendMode)}
              className="gap-2"
            >
              <ModeChoice
                value="dry_run"
                checked={p.mode === "dry_run"}
                icon={<ShieldCheck className="size-4" />}
                title="Dry run (default)"
                description="Generates and checks the PDF. Nothing is sent to anyone."
              />
              <ModeChoice
                value="test"
                checked={p.mode === "test"}
                disabled={!options[1]?.available}
                icon={<FlaskConical className="size-4" />}
                title="Test send"
                description={
                  options[1]?.available
                    ? `Sends only to the internal test number ${p.preview.test_destination_masked ?? ""}. The customer receives nothing.`
                    : (options[1]?.reason ?? "")
                }
              />
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Live sending to customers is off and can't be started from this screen.
              {p.preview.mapping_verified ? "" : " The template mapping is still being verified."}
            </p>
          </fieldset>

          {p.preview.already_sent.test && p.mode === "test" && p.phase === "ready" && (
            <Notice tone="warning">
              A test send for this invoice was already accepted by AiSensy.
            </Notice>
          )}
        </>
      ) : null}

      {p.configured && p.sendable && p.preview && (
        <div className="space-y-3 rounded-xl border p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge
              tone={phaseTones[p.phase]}
              label={phaseLabels[p.phase]}
              className="normal-case"
            />
          </div>

          {p.pending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {p.mode === "dry_run"
                ? "Preparing the invoice PDF and checking the link…"
                : "Preparing the invoice and sending it to the test number…"}
            </p>
          )}

          {p.result?.status === "dry_run" && (
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                The PDF was generated and checked. Nothing was sent.
              </p>
              {p.result.pdf_link ? (
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <a href={p.result.pdf_link} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Open generated PDF
                  </a>
                </Button>
              ) : null}
            </div>
          )}

          {p.result?.status === "accepted" && (
            <div className="space-y-1 text-sm">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                Test send to {p.result.destination_masked} was accepted by AiSensy.
              </p>
              <p className="text-xs text-muted-foreground">{ACCEPTED_NOTE}</p>
            </div>
          )}

          {error && (
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2 text-danger">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                {error.message}
              </p>
              {error.retry === "wait" && (
                <Button variant="outline" size="sm" className="rounded-lg" onClick={p.onRefresh}>
                  <RefreshCw className="size-4" /> Refresh
                </Button>
              )}
            </div>
          )}

          {p.needsConfirm && (
            <div className="flex items-start gap-2.5 rounded-lg bg-warning-soft p-3">
              <Checkbox
                id="wa-confirm-resend"
                checked={p.resendConfirmed}
                disabled={p.pending}
                onCheckedChange={(v) => p.onResendConfirmedChange(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="wa-confirm-resend" className="text-sm leading-snug font-normal">
                I understand this sends the invoice again to the test number.
              </Label>
            </div>
          )}
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" className="rounded-xl" onClick={p.onClose} disabled={p.pending}>
          {p.result ? "Close" : "Cancel"}
        </Button>
        {!p.configured && p.chatLink ? (
          <Button asChild variant="outline" className="rounded-xl">
            <a href={p.chatLink} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Open WhatsApp chat
            </a>
          </Button>
        ) : null}
        {p.configured && (
          <Button className="rounded-xl" disabled={blocked} onClick={p.onSubmit}>
            {p.pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : p.mode === "dry_run" ? (
              <ShieldCheck className="size-4" />
            ) : (
              <Send className="size-4" />
            )}{" "}
            {actionLabel}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  );
}

function ModeChoice({
  value,
  checked,
  disabled,
  icon,
  title,
  description,
}: {
  value: WhatsAppSendMode;
  checked: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const id = `wa-mode-${value}`;
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal transition-colors",
        checked && "border-primary bg-primary-soft/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <RadioGroupItem
        id={id}
        value={value}
        disabled={disabled}
        aria-label={title}
        aria-describedby={`${id}-description`}
        className="mt-0.5"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {title}
        </span>
        <span id={`${id}-description`} className="block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </Label>
  );
}

function Notice({ tone, children }: { tone: "warning" | "danger"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-xl px-3 py-2.5 text-sm",
        tone === "warning"
          ? "border border-warning/40 bg-warning-soft text-warning-foreground"
          : "border border-danger/20 bg-danger-soft text-danger",
      )}
    >
      {children}
    </p>
  );
}
