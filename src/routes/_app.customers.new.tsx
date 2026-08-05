import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/customers/new")({
  head: () => ({
    meta: [
      { title: "Add customer · Breath Care Kart" },
      {
        name: "description",
        content: "Create a patient record with attender details, address, WhatsApp and emergency contact.",
      },
      { property: "og:title", content: "Add customer · Breath Care Kart" },
      { property: "og:description", content: "Create a patient record with attender and contact details." },
    ],
  }),
  component: AddCustomerPage,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function AddCustomerPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add customer"
        description="Capture patient and attender information used across rentals and invoices."
        actions={
          <Button variant="ghost" className="rounded-xl" onClick={() => navigate({ to: "/customers" })}>
            <ArrowLeft className="size-4" /> Back to customers
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Customer record created");
          navigate({ to: "/customers" });
        }}
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-6">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Patient information</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name">
                <Input required placeholder="Ramesh Iyer" className="h-10 rounded-xl" />
              </Field>
              <Field label="Age">
                <Input required type="number" placeholder="68" className="h-10 rounded-xl" />
              </Field>
              <Field label="Gender">
                <Select defaultValue="Male">
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Condition / diagnosis">
                <Input placeholder="COPD, post-operative recovery…" className="h-10 rounded-xl" />
              </Field>
            </div>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Attender information</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Attender name">
                <Input required placeholder="Lakshmi Iyer" className="h-10 rounded-xl" />
              </Field>
              <Field label="Relationship">
                <Input required placeholder="Daughter" className="h-10 rounded-xl" />
              </Field>
              <Field label="Phone">
                <Input required placeholder="+91 98450 11223" className="h-10 rounded-xl" />
              </Field>
              <Field label="WhatsApp">
                <Input placeholder="+91 98450 11223" className="h-10 rounded-xl" />
              </Field>
              <Field label="Emergency contact">
                <Input placeholder="+91 99001 55442" className="h-10 rounded-xl" />
              </Field>
              <Field label="Email">
                <Input type="email" placeholder="family@example.com" className="h-10 rounded-xl" />
              </Field>
            </div>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Delivery address</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Address line">
                  <Input required placeholder="42, 7th Cross, Indiranagar" className="h-10 rounded-xl" />
                </Field>
              </div>
              <Field label="City">
                <Input required placeholder="Bengaluru" className="h-10 rounded-xl" />
              </Field>
              <Field label="Pincode">
                <Input required placeholder="560038" className="h-10 rounded-xl" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <Textarea placeholder="Lift available, delivery preferred before 6 PM…" className="min-h-24 rounded-xl" />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-xs lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Record summary</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Patient and attender details flow automatically into every invoice you generate for this account.
          </p>
          <Separator className="my-5" />
          <div className="flex flex-col gap-2">
            <Button type="submit" className="h-11 rounded-xl">
              <Save className="size-4" /> Save customer
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => navigate({ to: "/customers" })}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
