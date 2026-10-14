const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** ₹11,800 — accepts numbers or numeric strings from Postgres. */
export const inr = (value: number | string | null | undefined) => inrFmt.format(Number(value ?? 0));

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

const toDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value);

/** "05 Aug 2026" from "2026-08-05" or an ISO timestamp. */
export const formatDate = (value: string | null | undefined) =>
  value ? dateFmt.format(toDate(value)) : "—";

/** "05 Aug 2026, 11:20 am" */
export const formatDateTime = (value: string | null | undefined) =>
  value ? `${dateFmt.format(toDate(value))}, ${timeFmt.format(toDate(value))}` : "—";

/** Today as YYYY-MM-DD in the browser's timezone. */
export const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** YYYY-MM-DD plus n days. */
export const addDaysISO = (iso: string, days: number) => {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** YYYY-MM-DD plus n months (clamped to the month's last day). */
export const addMonthsISO = (iso: string, months: number) => {
  const d = toDate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Inclusive YYYY-MM-DD range check; empty bounds are open. */
export const inDateRange = (value: string | null | undefined, from: string, to: string) => {
  if (!value) return !from && !to;
  const day = value.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
};

/** "Aug 2026" bucket key for monthly charts: "2026-08". */
export const monthKey = (value: string) => value.slice(0, 7);
export const monthLabel = (key: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(`${key}-01T00:00:00`));

/** Last n month keys ending with the current month, oldest first. */
export const lastMonthKeys = (n: number) => {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
};

export const initials = (name: string | null | undefined) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

/** Indian mobile/landline check: 10 digits, optional +91 / 0 prefix, spaces or dashes allowed. */
export const isValidPhone = (value: string) =>
  /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$|^(?:0\d{2,4}[\s-]?)\d{6,8}$/.test(value.trim());

/** Digits only, for duplicate lookups ("+91 98450 11223" → "9845011223"). */
export const phoneDigits = (value: string) => value.replace(/\D/g, "").slice(-10);
