import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/db/query-keys";
import { createStaffUser, type CreatedStaff, type StaffRole } from "@/lib/db/staff";
import { notifyError, notifySuccess } from "@/lib/notify";
import { roleLabel, roleSummaries } from "@/lib/roles";

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Skips look-alike characters (0/O, 1/l/I) so a password read aloud or typed from a note works.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%&*?";

/** Random temporary password from the browser's secure random source. */
function generatePassword(length = 14) {
  const out: string[] = [];
  const limit = 256 - (256 % PASSWORD_CHARS.length);
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length)
        out.push(PASSWORD_CHARS[byte % PASSWORD_CHARS.length]!);
    }
  }
  return out.join("");
}

const staffRoles: StaffRole[] = ["telecaller", "supervisor"];

/**
 * Creates a staff login from the app. The account is made by a secure server
 * function that checks the caller is an admin; no admin key is used here.
 */
export function AddStaffDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Remount on open so every form starts empty and no password lingers in memory.
  return open ? <AddStaffForm onOpenChange={onOpenChange} /> : null;
}

function AddStaffForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<StaffRole>("telecaller");
  const [activate, setActivate] = useState(true);
  const [created, setCreated] = useState<{ user: CreatedStaff; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const nameError =
    fullName.trim().length > 0 && fullName.trim().length < 2 ? "Enter the full name" : null;
  const emailError =
    email.trim() && !EMAIL.test(email.trim()) ? "Enter a valid email address" : null;
  const passwordError =
    password.length > 0 && password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters`
      : null;
  const valid =
    fullName.trim().length >= 2 &&
    EMAIL.test(email.trim()) &&
    password.length >= MIN_PASSWORD &&
    !nameError &&
    !emailError &&
    !passwordError;

  const create = useMutation({
    mutationFn: () =>
      createStaffUser({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        activate,
      }),
    onSuccess: async (user) => {
      // The list and activity log update straight away.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
      ]);
      notifySuccess("Account created", `${user.full_name} · ${roleLabel(user.role)}`);
      setCreated({ user, password });
    },
    onError: (error) => notifyError(error, "Couldn't create the account"),
  });

  const copyCredentials = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${created.user.email}\nTemporary password: ${created.password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the details are on screen to copy by hand.
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !create.isPending && onOpenChange(next)}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Account created</DialogTitle>
              <DialogDescription>
                Share these sign-in details with {created.user.full_name} privately. The password
                won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="font-medium break-all">{created.user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Temporary password</dt>
                <dd className="font-mono font-medium break-all">{created.password}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd className="font-medium">
                  {roleLabel(created.user.role)}
                  {created.user.is_active ? "" : " · inactive until you activate them"}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Ask them to change the password on their Profile page after signing in.
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="rounded-xl" onClick={copyCredentials}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{" "}
                {copied ? "Copied" : "Copy details"}
              </Button>
              <Button className="rounded-xl" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && !create.isPending) create.mutate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Add staff user</DialogTitle>
              <DialogDescription>
                Creates a sign-in with a temporary password that you share with them.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                autoComplete="off"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 rounded-xl"
              />
              {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-xl"
              />
              {emailError ? <p className="text-xs text-destructive">{emailError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-password">Temporary password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="staff-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 rounded-xl pr-10 font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={() => {
                    setPassword(generatePassword());
                    setShowPassword(true);
                  }}
                >
                  <KeyRound className="size-4" /> Generate
                </Button>
              </div>
              {passwordError ? (
                <p className="text-xs text-destructive">{passwordError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD} characters. They can change it after signing in.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staffRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{roleSummaries[role]}</p>
            </div>

            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={activate}
                onCheckedChange={(v) => setActivate(v === true)}
                className="mt-0.5"
              />
              <span>
                Activate now
                <span className="block text-xs text-muted-foreground">
                  Untick to create the account inactive and activate it later from the list.
                </span>
              </span>
            </label>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={create.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={!valid || create.isPending}>
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Create
                account
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
