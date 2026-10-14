import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DataError } from "@/lib/db/errors";
import { notifyError, notifySuccess } from "@/lib/notify";
import { supabase } from "@/lib/supabase";

const MIN_LENGTH = 8;

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={id}>
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * Changes the signed-in user's password. Every role can use it.
 *
 * Supabase doesn't ask for the current password on its own, so we check it first
 * by signing in again with it. That stops someone at an unlocked screen from
 * taking over the account. A wrong password leaves the current session untouched.
 */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const sameAsCurrent = password.length > 0 && password === current;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid =
    current.length > 0 && password.length >= MIN_LENGTH && !sameAsCurrent && password === confirm;

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) throw new DataError("invalid", "Your session has expired. Sign in again.");

      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new DataError("invalid", "Current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new DataError("invalid", error.message);

      // Sign out other devices still using the old password. Not fatal if it fails.
      await supabase.auth.signOut({ scope: "others" });
    },
    onSuccess: () => {
      setCurrent("");
      setPassword("");
      setConfirm("");
      notifySuccess("Password changed", "Other devices have been signed out.");
    },
    onError: (error) => notifyError(error, "Password not changed"),
  });

  return (
    <Card className="gap-0 p-6 shadow-xs">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <KeyRound className="size-4" /> Change your password
      </h2>
      <Separator className="my-5" />
      <form
        noValidate
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <div className="sm:col-span-2">
          <Field id="current-password" label="Current password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="h-10 rounded-xl sm:max-w-[calc(50%-0.625rem)]"
            />
          </Field>
        </div>
        <Field
          id="new-password"
          label="New password"
          error={
            tooShort
              ? `Use at least ${MIN_LENGTH} characters`
              : sameAsCurrent
                ? "Choose a different password from your current one"
                : null
          }
        >
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>
        <Field
          id="confirm-password"
          label="Confirm new password"
          error={mismatch ? "Passwords don't match" : null}
        >
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" className="rounded-xl" disabled={!valid || save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}
