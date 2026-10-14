import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PasswordForm } from "@/components/profile/password-form";
import { PageHeader } from "@/components/shared/page-header";
import { PreviewNotice } from "@/components/shared/preview-notice";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/db/query-keys";
import { settingsQueries, updateCompanySettings } from "@/lib/db/settings";
import type { CompanySettings } from "@/lib/db/types";
import { formatDateTime, isValidPhone } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Breath Care Kart" },
      {
        name: "description",
        content: "Company details used on invoices, invoice numbering and account security.",
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
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function SettingsPage() {
  const query = useQuery(settingsQueries.company());
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Company details on invoices, invoice numbering and your password."
      />
      <Tabs defaultValue="company">
        <TabsList className="rounded-xl">
          <TabsTrigger value="company" className="rounded-lg">
            Company &amp; invoicing
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

function CompanyForm({ settings }: { settings: CompanySettings }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(settings.company_name);
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [email, setEmail] = useState(settings.email ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [gstin, setGstin] = useState(settings.gstin ?? "");
  const [prefix, setPrefix] = useState(settings.invoice_prefix);
  const [terms, setTerms] = useState(settings.invoice_terms ?? "");

  const errors = {
    name: name.trim().length < 2 ? "Enter the company name" : null,
    phone: phone.trim() && !isValidPhone(phone) ? "Enter a valid phone number" : null,
    email: email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Enter a valid email" : null,
    gstin:
      gstin.trim() && !GSTIN.test(gstin.trim().toUpperCase())
        ? "GSTIN should be 15 characters, e.g. 29ABCDE1234F1Z5"
        : null,
    prefix: !/^[A-Za-z0-9-]{1,12}$/.test(prefix.trim()) ? "1–12 letters, numbers or dashes" : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = useMutation({
    mutationFn: () =>
      updateCompanySettings({
        company_name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        gstin: gstin.trim().toUpperCase() || null,
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
        <h2 className="text-base font-semibold">Company details</h2>
        <p className="text-sm text-muted-foreground">Printed on every invoice and PDF.</p>
        <Separator className="my-5" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name *" error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field label="GSTIN" hint="Required for a GST tax invoice." error={errors.gstin}>
            <Input
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="h-10 rounded-xl font-mono uppercase"
            />
          </Field>
          <Field label="Contact number" error={errors.phone}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Registered address">
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
