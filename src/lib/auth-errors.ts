// Turns a Supabase Auth sign-in error into a short, safe message for the login screen.
// Raw server messages are never shown: they can be technical or reveal account details.
//
// Kept free of app imports so the unit tests can run with plain `node --test`.

type AuthErrorLike = {
  code?: string | undefined;
  status?: number | undefined;
  name?: string;
  message?: string;
};

export function signInErrorMessage(error: AuthErrorLike): string {
  const code = error.code ?? "";
  if (code === "invalid_credentials" || error.message === "Invalid login credentials") {
    return "Incorrect email or password.";
  }
  if (code === "email_not_confirmed") {
    return "This account's email address hasn't been confirmed yet. Ask your admin.";
  }
  if (code === "user_banned") return "This account is blocked. Ask your admin.";
  if (code.startsWith("over_") || error.status === 429) {
    return "Too many sign-in attempts. Wait a few minutes and try again.";
  }
  // supabase-js reports network failures as AuthRetryableFetchError (status 0) or a TypeError.
  if (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    /failed to fetch|network|load failed/i.test(error.message ?? "")
  ) {
    return "Couldn't reach the sign-in service. Check your internet connection and try again.";
  }
  if ((error.status ?? 0) >= 500) {
    return "The sign-in service is having a problem. Try again in a few minutes.";
  }
  return "Couldn't sign you in. Try again, or ask your admin if this keeps happening.";
}

/** What the user typed, cleaned up: autofill and paste often add spaces around an email. */
export const normalizeSignInEmail = (email: string) => email.trim();
