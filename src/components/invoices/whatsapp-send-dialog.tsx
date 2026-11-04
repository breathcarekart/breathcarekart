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
  UserRound,
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
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  isWhatsAppConfigured,
  sendWhatsApp,
  whatsAppChatLink,
  whatsAppQueries,
} from "@/lib/whatsapp";
import {
  ACCEPTED_NOTE,
  createSendGuard,
  describeSendError,
  inFlightPhase,
  initialSendMode,
  isOutcomeUnknown,
  maskCustomerPhone,
  modeOptions,
  needsResendConfirmation,
  phaseLabels,
  phaseTones,
  previewValues,
  resultPhase,
  templateInfo,
  type SendPhase,
  type TemplateName,
  type WhatsAppPreview,
  type WhatsAppSendMode,
  type WhatsAppSendResult,
} from "@/lib/whatsapp-ui";

const errorCodeOf = (error: unknown) => (error instanceof DataError && error.code) || "unexpected";

export type SummaryRow = { label: string; value: string };

/**
 * Sends one approved WhatsApp template through the server-side integration, after a
 * review step that shows exactly what will be sent. When the server allows it, the
 * default is sending to the customer; a test send and a dry run are also offered.
 */
export function WhatsAppSendDialog({
  open,
  onOpenChange,
  template,
  subjectId,
  customerName,
  phone,
  summary,
  blockedReason = null,
  fallbackMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateName;
  /** The invoice id (invoice templates) or rental id (rental templates). */
  subjectId: string;
  customerName: string;
  phone: string | null;
  /** Key facts shown above the message, e.g. invoice number and total. */
  summary: SummaryRow[];
  /** Why this can't be sent at all (e.g. a draft invoice); nothing is requested then. */
  blockedReason?: string | null;
  /** Text for the manual chat link offered while automatic sending is off. */
  fallbackMessage: string;
}) {
  const configured = isWhatsAppConfigured();
  const subject = { template, id: subjectId };
  const queryClient = useQueryClient();
  const guard = useRef(createSendGuard());
  const [chosenMode, setChosenMode] = useState<WhatsAppSendMode | null>(null);
  const [phase, setPhase] = useState<SendPhase>("ready");
  const [result, setResult] = useState<WhatsAppSendResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resendConfirmed, setResendConfirmed] = useState(false);
  // A send whose outcome is unknown (timeout, lost connection) may have reached the
  // recipient. Remembered per mode while this page is open, so switching modes or
  // reopening the dialog doesn't drop the confirmation step; cleared by the next success.
  const [outcomeUnknown, setOutcomeUnknown] = useState<Partial<Record<WhatsAppSendMode, true>>>({});

  const preview = useQuery({
    ...whatsAppQueries.preview(subject),
    enabled: open && configured && !blockedReason,
  });
  // Until staff pick a mode, start with the customer when the server allows it.
  const mode = chosenMode ?? initialSendMode(preview.data);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.history(subjectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.preview(subjectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });
  };

  const send = useMutation({
    mutationFn: (v: { mode: WhatsAppSendMode; confirmResend: boolean }) =>
      sendWhatsApp(subject, v.mode, v.confirmResend),
    onMutate: (v) => {
      setPhase(inFlightPhase(v.mode));
      setResult(null);
      setErrorCode(null);
    },
    onSuccess: (r, v) => {
      setPhase(resultPhase(r));
      setResult(r);
      setResendConfirmed(false);
      if (r.status === "accepted") setOutcomeUnknown((u) => ({ ...u, [v.mode]: undefined }));
      notifySuccess(
        r.status === "dry_run" ? "Dry run completed — nothing was sent" : "Accepted by AiSensy",
        r.status === "dry_run"
          ? templateInfo[template].title
          : `${v.mode === "live" ? "Sent to the customer" : "Test send"}. Not a delivery confirmation.`,
      );
    },
    onError: (error, v) => {
      const code = errorCodeOf(error);
      setPhase("failed");
      setErrorCode(code);
      setResendConfirmed(false);
      if (v.mode !== "dry_run" && isOutcomeUnknown(code)) {
        setOutcomeUnknown((u) => ({ ...u, [v.mode]: true }));
      }
    },
    onSettled: () => {
      guard.current.finish();
      // Every attempt is logged on the server, successful or not.
      invalidate();
    },
  });

  const reset = () => {
    setChosenMode(null);
    setPhase("ready");
    setResult(null);
    setErrorCode(null);
    setResendConfirmed(false);
  };

  // Start fresh every time the page opens the dialog.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset();
  }

  const needsConfirm =
    needsResendConfirmation(mode, preview.data, errorCode) || !!outcomeUnknown[mode];

  const submit = () => {
    if (needsConfirm && !resendConfirmed) return;
    if (!guard.current.tryStart()) return;
    send.mutate({ mode, confirmResend: needsConfirm && resendConfirmed });
  };

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
          template={template}
          configured={configured}
          blockedReason={blockedReason}
          customerName={preview.data?.recipient.name ?? customerName}
          phoneMasked={preview.data?.recipient.phone_masked ?? maskCustomerPhone(phone)}
          summary={summary}
          preview={preview.data ?? null}
          previewLoading={preview.isFetching && !preview.data}
          previewErrorCode={preview.error ? errorCodeOf(preview.error) : null}
          mode={mode}
          onModeChange={(m) => {
            setChosenMode(m);
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
            invalidate();
          }}
          onClose={() => onOpenChange(false)}
          chatLink={phone ? whatsAppChatLink(phone, fallbackMessage) : null}
        />
      </DialogContent>
    </Dialog>
  );
}

export type WhatsAppSendPanelProps = {
  template: TemplateName;
  configured: boolean;
  blockedReason: string | null;
  customerName: string;
  phoneMasked: string | null;
  summary: SummaryRow[];
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

const modeText = (p: WhatsAppSendPanelProps, mode: WhatsAppSendMode) =>
  mode === "live"
    ? {
        icon: <UserRound className="size-4" />,
        title: "Send to customer",
        description: `Sends this message to ${p.customerName} on ${p.phoneMasked ?? "their number"}.`,
      }
    : mode === "test"
      ? {
          icon: <FlaskConical className="size-4" />,
          title: "Test send",
          description: `Sends only to the internal test number ${p.preview?.test_destination_masked ?? ""}. The customer receives nothing.`,
        }
      : {
          icon: <ShieldCheck className="size-4" />,
          title: "Dry run",
          description: "Prepares and checks everything. Nothing is sent to anyone.",
        };

/** The dialog's contents, driven only by props (no data fetching). */
export function WhatsAppSendPanel(p: WhatsAppSendPanelProps) {
  const info = templateInfo[p.template];
  const options = modeOptions(p.preview);
  const selected = options.find((o) => o.mode === p.mode);
  const error = p.errorCode ? describeSendError(p.errorCode) : null;
  const previewError = p.previewErrorCode ? describeSendError(p.previewErrorCode) : null;
  const ready = p.configured && !p.blockedReason && !!p.preview && !previewError;
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
          : p.mode === "live"
            ? "Send to customer"
            : "Send test";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-success-soft text-success">
            <MessageCircle className="size-4" />
          </span>
          {info.title}
        </DialogTitle>
        <DialogDescription>{info.about}</DialogDescription>
      </DialogHeader>

      <dl className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
        <Field label="Customer" value={p.customerName} />
        <Field label="WhatsApp number" value={p.phoneMasked ?? "No number on file"} />
        {p.summary.map((row) => (
          <Field key={row.label} label={row.label} value={row.value} />
        ))}
        {p.preview?.attachment_filename ? (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Attachment</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-medium">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{p.preview.attachment_filename}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {!p.configured ? (
        <PreviewNotice>
          WhatsApp sending isn't switched on for this environment, so nothing will be sent from
          here. You can open a chat and send the message yourself.
        </PreviewNotice>
      ) : p.blockedReason ? (
        <Notice tone="warning">{p.blockedReason}</Notice>
      ) : p.previewLoading ? (
        <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Preparing the message…
        </p>
      ) : previewError ? (
        <Notice tone="danger">{previewError.message}</Notice>
      ) : p.preview ? (
        <>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Message values
            </p>
            <dl className="space-y-1.5 text-sm">
              {previewValues(p.preview, p.template).map((v) => (
                <div key={v.label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                  <dt className="text-muted-foreground">{v.label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium">{v.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <fieldset className="space-y-2" disabled={p.pending}>
            <legend className="mb-2 text-sm font-medium">How to send</legend>
            <RadioGroup
              value={p.mode}
              onValueChange={(v) => p.onModeChange(v as WhatsAppSendMode)}
              className="gap-2"
            >
              {options
                .filter((o) => o.available || o.mode !== "live")
                .map((o) => {
                  const t = modeText(p, o.mode);
                  return (
                    <ModeChoice
                      key={o.mode}
                      value={o.mode}
                      checked={p.mode === o.mode}
                      disabled={!o.available}
                      icon={t.icon}
                      title={t.title}
                      description={o.available ? t.description : (o.reason ?? "")}
                    />
                  );
                })}
            </RadioGroup>
            {!p.preview.modes.live && (
              <p className="text-xs text-muted-foreground">
                Sending to customers is switched off on the server.
              </p>
            )}
          </fieldset>

          {p.mode !== "dry_run" &&
            p.phase === "ready" &&
            (p.mode === "live" ? p.preview.already_sent.live : p.preview.already_sent.test) && (
              <Notice tone="warning">
                This message was already sent {p.mode === "live" ? "to the customer" : "as a test"}.
              </Notice>
            )}
        </>
      ) : null}

      {ready && (
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
                ? "Preparing the message and checking the attachment…"
                : p.mode === "live"
                  ? "Sending to the customer…"
                  : "Sending to the test number…"}
            </p>
          )}

          {p.result?.status === "dry_run" && (
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                Everything was prepared and checked. Nothing was sent.
              </p>
              {p.result.pdf_link ? (
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <a href={p.result.pdf_link} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Open attachment
                  </a>
                </Button>
              ) : null}
            </div>
          )}

          {p.result?.status === "accepted" && (
            <div className="space-y-1 text-sm">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                {p.result.mode === "live" ? "Message" : "Test send"} to{" "}
                {p.result.destination_masked} was accepted by AiSensy.
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
                I understand this sends the message again
                {p.mode === "live" ? " to the customer" : " to the test number"}.
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
