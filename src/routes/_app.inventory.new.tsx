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
import { equipmentTypes } from "@/lib/data";

export const Route = createFileRoute("/_app/inventory/new")({
  head: () => ({
    meta: [
      { title: "Add equipment · Breath Care Kart" },
      {
        name: "description",
        content: "Register a new rental asset with brand, model, serial number, purchase date and rental pricing.",
      },
      { property: "og:title", content: "Add equipment · Breath Care Kart" },
      { property: "og:description", content: "Register a new rental asset in the Breath Care Kart fleet." },
    ],
  }),
  component: AddEquipmentPage,
});

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AddEquipmentPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add equipment"
        description="Register a new asset into the rental fleet. All fields except notes are required."
        actions={
          <Button variant="ghost" className="rounded-xl" onClick={() => navigate({ to: "/inventory" })}>
            <ArrowLeft className="size-4" /> Back to inventory
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Equipment added to inventory");
          navigate({ to: "/inventory" });
        }}
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-6">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Asset identity</h2>
            <p className="text-sm text-muted-foreground">How this unit appears across invoices and rentals.</p>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Equipment type">
                <Select defaultValue="Oxygen Concentrator">
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Equipment name">
                <Input required placeholder="Oxygen Concentrator 5L" className="h-10 rounded-xl" />
              </Field>
              <Field label="Brand">
                <Input required placeholder="Philips" className="h-10 rounded-xl" />
              </Field>
              <Field label="Model">
                <Input required placeholder="EverFlo 5L" className="h-10 rounded-xl" />
              </Field>
              <Field label="Serial number" hint="Printed on the rear label of the unit.">
                <Input required placeholder="PH-5L-88213" className="h-10 rounded-xl font-mono" />
              </Field>
              <Field label="Purchase date">
                <Input required type="date" defaultValue="2026-08-05" className="h-10 rounded-xl" />
              </Field>
            </div>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Availability &amp; pricing</h2>
            <p className="text-sm text-muted-foreground">Rates default onto every new invoice line.</p>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Status">
                <Select defaultValue="available">
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="rented">Rented</SelectItem>
                    <SelectItem value="service">In service</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Daily rate (₹)">
                <Input required type="number" defaultValue={450} className="h-10 rounded-xl" />
              </Field>
              <Field label="Monthly rate (₹)">
                <Input required type="number" defaultValue={7500} className="h-10 rounded-xl" />
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Notes">
                <Textarea
                  placeholder="Service history, accessories included, storage location…"
                  className="min-h-28 rounded-xl"
                />
              </Field>
            </div>
          </Card>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-xs lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Before you save</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>· Serial numbers must be unique across the fleet.</li>
            <li>· Units marked in service are hidden from invoice selection.</li>
            <li>· Purchase date drives depreciation in reports.</li>
          </ul>
          <Separator className="my-5" />
          <div className="flex flex-col gap-2">
            <Button type="submit" className="h-11 rounded-xl">
              <Save className="size-4" /> Save equipment
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => navigate({ to: "/inventory" })}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
