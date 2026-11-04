import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ImageUp, Loader2, QrCode, Save } from "lucide-react";
import { cloneElement, useId, useRef, useState } from "react";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PasswordForm } from "@/components/profile/password-form";
import { PageHeader } from "@/components/shared/page-header";
import { PreviewNotice } from "@/components/shared/preview-notice";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/db/query-keys";
import {
  paymentQrUrl,
  settingsQueries,
  updateCompanySettings,
  uploadPaymentQr,
} from "@/lib/db/settings";
import type { CompanySettings } from "@/lib/db/types";
import { formatDateTime, isValidPhone } from "@/lib/format";
import { checkGstin, GST_RATES } from "@/lib/gst";
import { notifyError, notifySuccess } from "@/lib/notify";
import { isValidUpiId } from "../../supabase/functions/send-invoice-whatsapp/whatsapp.ts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Breath Care Kart" },
      {
        name: "description",
        content:
          "Business and GST details used on invoices, invoice numbering and account security.",
      },
    ],
  }),
  component: SettingsPage,
});

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  /** One input (or select trigger); it gets the label's id and the hint/error text. */
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const id = useId();
  const message = error ?? hint;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      {cloneElement(children, {
        id,
        ...(message ? { "aria-describedby": `${id}-message` } : {}),
      })}
      {message ? (
        <p
          id={`${id}-message`}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function SettingsPage() {
  const query = useQuery(settingsQueries.company());
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Business and GST details on invoices, invoice numbering and your password."
      />
      <Tabs defaultValue="company">
        <TabsList className="rounded-xl">
          <TabsTrigger value="company" className="rounded-lg">
            Business &amp; GST
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg">
            Security
          </TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-5">
          <QueryState
            query={query}
            loading={<CardsSkeleton count={2} />}
            errorTitle="Couldn't load settings"
          >
            {(settings) =>
              settings ? (
                <CompanyForm settings={settings} />
              ) : (
                <PreviewNotice>
                  Company settings row is missing — apply the Phase 3 database migrations.
                </PreviewNotice>
              )
            }
          </QueryState>
        </TabsContent>
        <TabsContent value="security" className="mt-5">
          <PasswordForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const NO_DEFAULT_RATE = "none";

function CompanyForm({ settings }: { settings: CompanySettings }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(settings.company_name);
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [email, setEmail] = useState(settings.email ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [registered, setRegistered] = useState(settings.gst_registered);
  const [gstin, setGstin] = useState(settings.gstin ?? "");
  const [defaultRate, setDefaultRate] = useState(
    settings.default_gst_rate == null ? NO_DEFAULT_RATE : String(Number(settings.default_gst_rate)),
  );
  const [signatory, setSignatory] = useState(settings.authorised_signatory ?? "");
  const [prefix, setPrefix] = useState(settings.invoice_prefix);
  const [terms, setTerms] = useState(settings.invoice_terms ?? "");
  const [upiId, setUpiId] = useState(settings.upi_id ?? "");
  const [qrPath, setQrPath] = useState(settings.payment_qr_path ?? null);
  const qrInput = useRef<HTMLInputElement>(null);
  const qrPreview = useQuery({
    queryKey: ["settings", "payment-qr", qrPath],
    queryFn: () => paymentQrUrl(qrPath!),
    enabled: !!qrPath,
    staleTime: 5 * 60_000,
  });
  const qrUpload = useMutation({
    mutationFn: uploadPaymentQr,
    onSuccess: (path) => {
      setQrPath(path);
      notifySuccess("QR image uploaded", "Save changes to use it in payment reminders.");
    },
    onError: (error) => notifyError(error, "QR image not uploaded"),
  });

  const gstinCheck = checkGstin(gstin);
  const errors = {
    name: name.trim().length < 2 ? "Enter the business name" : null,
    phone: phone.trim() && !isValidPhone(phone) ? "Enter a valid phone number" : null,
    email:
      email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
        ? "Enter a valid email"
        : null,
    // Not registered: no GSTIN is needed (and none is saved).
    gstin: registered && !gstinCheck.ok ? gstinCheck.message : null,
    signatory: signatory.trim() && signatory.trim().length < 2 ? "Enter the full name" : null,
    upi: upiId.trim() && !isValidUpiId(upiId) ? "Enter a UPI ID like name@bank" : null,
    prefix: !/^[A-Za-z0-9-]{1,12}$/.test(prefix.trim()) ? "1–12 letters, numbers or dashes" : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const clearsGstin = !registered && !!settings.gstin;

  const save = useMutation({
    mutationFn: () =>
      updateCompanySettings({
        company_name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        gst_registered: registered,
        gstin: registered && gstinCheck.ok ? gstinCheck.gstin : null,
        default_gst_rate: defaultRate === NO_DEFAULT_RATE ? null : Number(defaultRate),
        authorised_signatory: signatory.trim() || null,
        upi_id: upiId.trim() || null,
        payment_qr_path: qrPath,
        invoice_prefix: prefix.trim(),
        invoice_terms: terms.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      notifySuccess("Settings saved", "New invoices and PDFs use these details.");
    },
    onError: (error) => notifyError(error, "Couldn't save settings"),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate();
      }}
      className="space-y-6"
    >
      <Card className="gap-0 p-6 shadow-xs">
        <h2 className="text-base font-semibold">Business details</h2>
        <p className="text-sm text-muted-foreground">Printed on every invoice and PDF.</p>
        <Separator className="my-5" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business name *" error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field label="Business email" error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field label="Business phone" error={errors.phone}>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field
            label="Authorised signatory"
            hint="Optional. Printed under “Authorized Signature” on invoices."
            error={errors.signatory}
          >
            <Input
              value={signatory}
              onChange={(e) => setSignatory(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Business address">
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="min-h-24 rounded-xl"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-6 shadow-xs">
        <h2 className="text-base font-semibold">GST</h2>
        <p className="text-sm text-muted-foreground">
          Registered businesses get a “Tax invoice” with the GSTIN printed on it.
        </p>
        <Separator className="my-5" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-sm">GST registration status</Label>
            <RadioGroup
              value={registered ? "registered" : "not_registered"}
              onValueChange={(v) => setRegistered(v === "registered")}
              className="grid gap-2 sm:grid-cols-2"
            >
              {(
                [
                  ["registered", "Registered", "Has a GSTIN. Invoices are titled “Tax invoice”."],
                  ["not_registered", "Not registered", "No GSTIN. Invoices are titled “Invoice”."],
                ] as const
              ).map(([value, title, description]) => (
                <Label
                  key={value}
                  htmlFor={`gst-${value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal transition-colors",
                    (value === "registered") === registered && "border-primary bg-primary-soft/40",
                  )}
                >
                  <RadioGroupItem
                    id={`gst-${value}`}
                    value={value}
                    aria-label={title}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {registered ? (
            <Field
              label="GSTIN *"
              hint="Format and check character are validated here. This doesn't confirm the registration; check it on the GST portal."
              error={errors.gstin}
            >
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!errors.gstin}
                className="h-10 rounded-xl font-mono uppercase"
              />
            </Field>
          ) : clearsGstin ? (
            <PreviewNotice className="self-start sm:col-span-2">
              The saved GSTIN will be removed when you save, and invoices will stop showing it.
            </PreviewNotice>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="default-gst-rate" className="text-sm">
              Default GST rate
            </Label>
            <Select value={defaultRate} onValueChange={setDefaultRate}>
              <SelectTrigger
                id="default-gst-rate"
                aria-describedby="default-gst-rate-hint"
                className="h-10 rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT_RATE}>No default (choose per invoice)</SelectItem>
                {GST_RATES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="default-gst-rate-hint" className="text-xs text-muted-foreground">
              Pre-selected on new invoices. Staff can still change it per invoice.
            </p>
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-6 shadow-xs">
        <h2 className="text-base font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Sent in WhatsApp payment reminders. The QR code and the UPI ID should be for the same
          account.
        </p>
        <Separator className="my-5" />
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <Field
            label="UPI ID"
            hint="Printed in payment reminders, e.g. name@bank."
            error={errors.upi}
          >
            <Input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-10 rounded-xl font-mono"
            />
          </Field>
          <div className="space-y-2">
            <Label className="text-sm">Payment QR image</Label>
            <div className="flex items-center gap-3">
              <span className="flex size-24 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                {qrPreview.data ? (
                  <img
                    src={qrPreview.data}
                    alt="Payment QR code"
                    className="size-full object-contain"
                  />
                ) : (
                  <QrCode className="size-8 text-muted-foreground" />
                )}
              </span>
              <div className="space-y-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={qrUpload.isPending}
                  onClick={() => qrInput.current?.click()}
                >
                  {qrUpload.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImageUp className="size-4" />
                  )}{" "}
                  {qrPath ? "Replace image" : "Upload image"}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
              </div>
              <input
                ref={qrInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) qrUpload.mutate(file);
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-6 shadow-xs">
        <h2 className="text-base font-semibold">Invoicing</h2>
        <Separator className="my-5" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Invoice prefix"
            hint={`Numbers look like ${prefix.trim() || "BCK"}/${new Date().getFullYear()}/0001 and restart each year.`}
            error={errors.prefix}
          >
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="h-10 rounded-xl font-mono"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Terms printed on invoices"
              hint="Optional. Shown under Notes / Terms on every invoice."
            >
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="min-h-24 rounded-xl"
              />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Last updated {formatDateTime(settings.updated_at)}
        </p>
        <Button type="submit" className="rounded-xl" disabled={!valid || save.isPending}>
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}{" "}
          Save changes
        </Button>
      </div>
    </form>
  );
}
