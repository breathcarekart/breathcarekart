import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, ShieldCheck, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import loginArt from "@/assets/login-illustration.jpg";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in · Breath Care Kart Operations" },
      {
        name: "description",
        content:
          "Secure sign in to Breath Care Kart — manage medical equipment inventory, rentals, customers and invoices in one workspace.",
      },
      { property: "og:title", content: "Sign in · Breath Care Kart Operations" },
      {
        property: "og:description",
        content: "Inventory, rentals and invoicing for medical equipment rental teams.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((session) => {
      if (session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : signInError.message,
      );
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="page-enter mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <Stethoscope className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">Breath Care Kart</span>
              <span className="block text-xs text-muted-foreground">Rental Operations</span>
            </span>
          </div>

          <h1 className="mt-10 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage inventory, rentals and invoicing for your care network.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="remember" defaultChecked />
              <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                Keep me signed in on this device
              </Label>
            </div>

            <Button type="submit" size="lg" className="h-11 w-full rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-success" />
            Protected workspace · audit logged
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Need access?{" "}
            <Link to="/dashboard" className="font-medium text-primary hover:underline">
              Explore the demo workspace
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-primary-soft lg:block">
        <img
          src={loginArt}
          alt="Medical rental equipment and inventory dashboard illustration"
          className="size-full object-cover"
        />
        <div className="glass-panel absolute bottom-10 left-10 right-10 rounded-2xl p-6">
          <p className="text-lg font-medium leading-snug">
            “Every concentrator, bed and invoice — tracked in one calm workspace.”
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            412 assets · 1,280 rentals fulfilled · 99.2% on-time delivery
          </p>
        </div>
      </div>
    </div>
  );
}
