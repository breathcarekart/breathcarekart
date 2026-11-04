-- Business and GST settings managed by the admin in Settings.
--
-- Adds to the single company_settings row:
--   gst_registered        Registered / Not registered for GST (default: not registered)
--   default_gst_rate      optional rate pre-selected on new invoices (staff can still change it)
--   authorised_signatory  optional name printed under "Authorized Signature" on invoices
-- and database checks so the stored details stay consistent whatever the caller:
--   * a GSTIN must have the GSTIN format (the app also checks the check character);
--   * Registered needs a GSTIN. (The app clears the GSTIN when an admin chooses Not
--     registered, and invoices print a GSTIN only for a registered business. The rule is
--     one-way so the app version already deployed, which saves a GSTIN without this
--     column, keeps working until the new version is released.)
--   * the default rate must be one of the rates offered on invoices;
--   * the business email, if set, must look like an email address.
--
-- Who can change it is unchanged: only active admins may update company_settings
-- ("company_settings_update" policy, public.is_admin()); every staff role can read it.
-- Invoices keep the tax rate and amounts saved on them, so no existing invoice changes.
--
-- Depends on: 20261008000200 (company_settings), 20261008000300 (its policies).
-- Safe to re-run.

alter table public.company_settings
  add column if not exists gst_registered boolean not null default false,
  add column if not exists default_gst_rate numeric(5, 2),
  add column if not exists authorised_signatory text;

-- Keep current behaviour: a GSTIN that is already saved means the business is registered.
update public.company_settings
  set gst_registered = true
  where gstin is not null and not gst_registered;

-- Store GSTINs in one form (upper case, no spaces) before the format check.
update public.company_settings
  set gstin = upper(regexp_replace(gstin, '\s', '', 'g'))
  where gstin is not null and gstin <> upper(regexp_replace(gstin, '\s', '', 'g'));

alter table public.company_settings
  drop constraint if exists company_settings_gstin_format,
  drop constraint if exists company_settings_gst_registration,
  drop constraint if exists company_settings_default_gst_rate,
  drop constraint if exists company_settings_email_format,
  drop constraint if exists company_settings_signatory_length;

alter table public.company_settings
  add constraint company_settings_gstin_format check (
    gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ),
  add constraint company_settings_gst_registration check (
    not gst_registered or gstin is not null
  ),
  add constraint company_settings_default_gst_rate check (
    default_gst_rate is null or default_gst_rate in (0, 5, 12, 18, 28)
  ),
  add constraint company_settings_email_format check (
    email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  add constraint company_settings_signatory_length check (
    authorised_signatory is null or char_length(authorised_signatory) between 2 and 100
  );
