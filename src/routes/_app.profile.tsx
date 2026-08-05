import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Profile · Breath Care Kart" },
      { name: "description", content: "Your operator profile, contact details and workspace permissions." },
      { property: "og:title", content: "Profile · Breath Care Kart" },
      { property: "og:description", content: "Operator profile and workspace permissions." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="How you appear to your team and on generated invoices."
        actions={
          <Button className="rounded-xl" onClick={() => toast.success("Profile updated")}>
            <Save className="size-4" /> Save profile
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="gap-0 p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">AK</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">Arjun Kamath</p>
              <p className="text-sm text-muted-foreground">Operations Admin · Bengaluru hub</p>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Full name</Label>
              <Input defaultValue="Arjun Kamath" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Role</Label>
              <Input defaultValue="Operations Admin" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Email</Label>
              <Input defaultValue="arjun@breathcarekart.in" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Phone</Label>
              <Input defaultValue="+91 98860 44120" className="h-10 rounded-xl" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-sm">Bio</Label>
              <Textarea
                defaultValue="Managing rental logistics and billing for 400+ respiratory care assets across Karnataka."
                className="min-h-24 rounded-xl"
              />
            </div>
          </div>
        </Card>

        <Card className="h-fit gap-0 p-6 shadow-xs">
          <h2 className="text-base font-semibold">Workspace</h2>
          <Separator className="my-4" />
          <ul className="space-y-4 text-sm">
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-success" /> Full inventory &amp; billing access
            </li>
            <li className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" /> arjun@breathcarekart.in
            </li>
            <li className="flex items-center gap-3">
              <Phone className="size-4 text-muted-foreground" /> +91 98860 44120
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="size-4 text-muted-foreground" /> HSR Layout, Bengaluru
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
