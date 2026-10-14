import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Mail, Phone, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PasswordForm } from "@/components/profile/password-form";
import { RoleBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateProfile } from "@/lib/db/profiles";
import { queryKeys } from "@/lib/db/query-keys";
import { formatDate, initials, isValidPhone } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { roleSummaries, useCurrentUser } from "@/lib/roles";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Profile · Breath Care Kart" },
      { name: "description", content: "Your name and contact details as your team sees them." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { profile, role, name } = useCurrentUser();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  const nameError = fullName.trim().length < 2 ? "Enter your full name" : null;
  const phoneError = phone.trim() && !isValidPhone(phone) ? "Enter a valid phone number" : null;

  const save = useMutation({
    // Name and phone only; role and access are admin-controlled in the database.
    mutationFn: () =>
      updateProfile(profile.id, { full_name: fullName.trim(), phone: phone.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      notifySuccess("Profile updated");
    },
    onError: (error) => notifyError(error, "Couldn't update profile"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="How you appear to your team, on invoices you create and in the activity log."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="gap-0 p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{name}</p>
              <RoleBadge role={role} />
            </div>
          </div>
          <Separator className="my-6" />
          <form
            noValidate
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameError && !phoneError) save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="profile-name">
                Full name
              </Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 rounded-xl"
              />
              {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="profile-phone">
                Phone
              </Label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 rounded-xl"
              />
              {phoneError ? <p className="text-xs text-destructive">{phoneError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Email</Label>
              <Input readOnly value={profile.email ?? ""} className="h-10 rounded-xl bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Member since</Label>
              <Input
                readOnly
                value={formatDate(profile.created_at)}
                className="h-10 rounded-xl bg-muted/50"
              />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button
                type="submit"
                className="rounded-xl"
                disabled={!!nameError || !!phoneError || save.isPending}
              >
                {save.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}{" "}
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit gap-0 p-6 shadow-xs">
          <h2 className="text-base font-semibold">Access</h2>
          <Separator className="my-4" />
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> {roleSummaries[role]}
            </li>
            <li className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" /> {profile.email ?? "—"}
            </li>
            <li className="flex items-center gap-3">
              <Phone className="size-4 text-muted-foreground" /> {profile.phone ?? "—"}
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Role changes are made by an admin on Users &amp; Roles.
          </p>
        </Card>
      </div>

      <PasswordForm />
    </div>
  );
}
