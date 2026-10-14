import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerInput } from "@/lib/db/customers";
import type { Customer } from "@/lib/db/types";
import { isValidPhone, phoneDigits } from "@/lib/format";

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPhone(v), "Enter a valid 10-digit phone number");

const schema = z.object({
  name: z.string().trim().min(2, "Enter the patient's full name").max(120),
  age: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 120),
      "Enter an age between 0 and 120",
    ),
  gender: z.string(),
  attender_name: z.string().trim().max(120),
  attender_relation: z.string().trim().max(60),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .refine(isValidPhone, "Enter a valid 10-digit phone number"),
  whatsapp: optionalPhone,
  emergency_contact: optionalPhone,
  address: z.string().trim().min(5, "Enter the delivery address").max(400),
  city: z.string().trim().min(2, "Enter the city").max(80),
  notes: z.string().trim().max(1000),
});

type FormValues = z.infer<typeof schema>;

const toValues = (c?: Customer | null): FormValues => ({
  name: c?.name ?? "",
  age: c?.age != null ? String(c.age) : "",
  gender: c?.gender ?? "",
  attender_name: c?.attender_name ?? "",
  attender_relation: c?.attender_relation ?? "",
  phone: c?.phone ?? "",
  whatsapp: c?.whatsapp ?? "",
  emergency_contact: c?.emergency_contact ?? "",
  address: c?.address ?? "",
  city: c?.city ?? "",
  notes: c?.notes ?? "",
});

const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());

const toCustomerInput = (v: FormValues): CustomerInput => ({
  name: v.name.trim(),
  age: v.age ? Number(v.age) : null,
  gender: blankToNull(v.gender),
  attender_name: blankToNull(v.attender_name),
  attender_relation: blankToNull(v.attender_relation),
  phone: v.phone.trim(),
  whatsapp: blankToNull(v.whatsapp),
  emergency_contact: blankToNull(v.emergency_contact),
  address: blankToNull(v.address),
  city: blankToNull(v.city),
  notes: blankToNull(v.notes),
});

/**
 * Patient / attender / address form used to add and edit customers.
 * Fields map 1:1 to the `customers` table.
 */
export function CustomerForm({
  initial,
  existing,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
  aside,
}: {
  initial?: Customer | null;
  /** Other customers, for the duplicate-phone warning. */
  existing: Pick<Customer, "id" | "name" | "phone" | "whatsapp">[];
  submitting: boolean;
  submitLabel: string;
  onSubmit: (input: CustomerInput) => void;
  onCancel: () => void;
  aside?: ReactNode;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(initial),
  });
  const [duplicateOk, setDuplicateOk] = useState(false);

  const phone = form.watch("phone");
  const digits = phoneDigits(phone);
  const duplicates =
    digits.length === 10
      ? existing.filter(
          (c) =>
            c.id !== initial?.id &&
            [c.phone, c.whatsapp].some((p) => p && phoneDigits(p) === digits),
        )
      : [];
  const needsConfirm = duplicates.length > 0 && !duplicateOk;

  const text = (
    name: keyof FormValues,
    label: string,
    placeholder: string,
    props: Record<string, unknown> = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} className="h-10 rounded-xl" {...props} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (needsConfirm) return;
          onSubmit(toCustomerInput(values));
        })}
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-6">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Patient information</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              {text("name", "Full name *", "Patient's full name", { autoComplete: "off" })}
              {text("age", "Age", "Years", { inputMode: "numeric" })}
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Contact &amp; attender</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              {text("phone", "Phone *", "10-digit mobile number", { inputMode: "tel" })}
              {text("whatsapp", "WhatsApp", "If different from phone", { inputMode: "tel" })}
              {text("attender_name", "Attender name", "Person caring for the patient")}
              {text("attender_relation", "Relationship", "e.g. Daughter")}
              {text("emergency_contact", "Emergency contact", "10-digit number", {
                inputMode: "tel",
              })}
            </div>
            {duplicates.length > 0 && (
              <div className="mt-5 flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">This phone number is already on file</p>
                  <ul className="text-muted-foreground">
                    {duplicates.slice(0, 3).map((d) => (
                      <li key={d.id}>
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: d.id }}
                          className="text-primary hover:underline"
                        >
                          {d.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 pt-1 text-xs">
                    <input
                      type="checkbox"
                      checked={duplicateOk}
                      onChange={(e) => setDuplicateOk(e.target.checked)}
                      className="size-3.5 accent-[var(--primary)]"
                    />
                    It&apos;s a different patient (e.g. same family) — save anyway
                  </label>
                </div>
              </div>
            )}
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Delivery address</h2>
            <Separator className="my-5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {text("address", "Address *", "House, street, area, pincode")}
              </div>
              {text("city", "City *", "e.g. Bengaluru")}
              <div className="sm:col-span-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Condition, access instructions, preferred delivery time…"
                          className="min-h-24 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-xs lg:sticky lg:top-24">
          {aside}
          <div className="flex flex-col gap-2">
            <Button type="submit" className="h-11 rounded-xl" disabled={submitting || needsConfirm}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {submitting ? "Saving…" : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}
