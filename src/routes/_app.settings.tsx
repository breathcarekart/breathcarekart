import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Breath Care Kart" },
      {
        name: "description",
        content: "Configure company details, invoice numbering, GST, branding, theme and account security.",
      },
      { property: "og:title", content: "Settings · Breath Care Kart" },
      { property: "og:description", content: "Company, invoicing, branding and security configuration." },
    ],
  }),
  component: SettingsPage,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ title, description, defaultChecked }: { title: string; description: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl border p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked ?? false} />
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace configuration for invoicing, branding and security."
        actions={
          <Button className="rounded-xl" onClick={() => toast.success("Settings saved")}>
            <Save className="size-4" /> Save changes
          </Button>
        }
      />

      <Tabs defaultValue="company">
        <TabsList className="rounded-xl">
          <TabsTrigger value="company" className="rounded-lg">
            Company
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="rounded-lg">
            Invoicing
          </TabsTrigger>
          <TabsTrigger value="branding" className="rounded-lg">
            Branding
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg">
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-5">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Company details</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Company name">
                <Input defaultValue="Breath Care Kart" className="h-10 rounded-xl" />
              </Field>
              <Field label="Contact number">
                <Input defaultValue="+91 80 4711 2200" className="h-10 rounded-xl" />
              </Field>
              <Field label="Support email">
                <Input defaultValue="care@breathcarekart.in" className="h-10 rounded-xl" />
              </Field>
              <Field label="City">
                <Input defaultValue="Bengaluru" className="h-10 rounded-xl" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Registered address">
                  <Textarea
                    defaultValue="No. 18, HSR Layout Sector 2, Bengaluru, Karnataka 560102"
                    className="min-h-24 rounded-xl"
                  />
                </Field>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="invoicing" className="mt-5">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Invoice configuration</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Invoice prefix">
                <Input defaultValue="BCK/2026/" className="h-10 rounded-xl font-mono" />
              </Field>
              <Field label="Next number">
                <Input defaultValue="0097" className="h-10 rounded-xl font-mono" />
              </Field>
              <Field label="GSTIN">
                <Input defaultValue="29ABCDE1234F1Z5" className="h-10 rounded-xl font-mono" />
              </Field>
              <Field label="GST rate (%)">
                <Input type="number" defaultValue={12} className="h-10 rounded-xl" />
              </Field>
              <Field label="Payment terms (days)">
                <Input type="number" defaultValue={7} className="h-10 rounded-xl" />
              </Field>
              <Field label="Default deposit (₹)">
                <Input type="number" defaultValue={5000} className="h-10 rounded-xl" />
              </Field>
            </div>
            <Separator className="my-5" />
            <div className="grid gap-3">
              <ToggleRow title="Auto-send invoice on WhatsApp" description="Deliver the PDF to the attender when generated." defaultChecked />
              <ToggleRow title="Payment reminders" description="Nudge customers two days before the due date." defaultChecked />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-5">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Branding &amp; theme</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Invoice footer note">
                <Input defaultValue="Thank you for trusting Breath Care Kart." className="h-10 rounded-xl" />
              </Field>
              <Field label="Signatory name">
                <Input defaultValue="Arjun Kamath" className="h-10 rounded-xl" />
              </Field>
            </div>
            <Separator className="my-5" />
            <div className="grid gap-3">
              <ToggleRow title="Show QR code on invoices" description="Adds a UPI payment QR block to printed invoices." defaultChecked />
              <ToggleRow title="Compact density" description="Tighter table rows across the workspace." />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-5">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Security</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Current password">
                <Input type="password" placeholder="••••••••" className="h-10 rounded-xl" />
              </Field>
              <Field label="New password">
                <Input type="password" placeholder="••••••••" className="h-10 rounded-xl" />
              </Field>
            </div>
            <Separator className="my-5" />
            <div className="grid gap-3">
              <ToggleRow title="Two-factor authentication" description="Require an OTP on every new device." defaultChecked />
              <ToggleRow title="Audit log export" description="Weekly CSV of every invoice and inventory action." />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
