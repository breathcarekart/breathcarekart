-- Initial business details confirmed by the client for the handover (04 Nov 2026):
--   business email        breathcarekart@gmail.com
--   GSTIN/UIN             36AALCG1309A1Z4 (client-provided; format and check character
--                         are valid, registration itself not independently verified)
--   authorised signatory  Harinath Neelam (business owner)
--
-- Data only, one row: public.company_settings. It fills in fields that are still empty
-- and never overwrites a value an admin has already entered in Settings, so re-running it
-- (or running it after the admin has made changes) changes nothing. Afterwards every
-- value can be changed by an admin in Settings → Business & GST; nothing is hardcoded in
-- the app. No invoices, customers, payments or users are touched, and invoices keep the
-- amounts they were created with.
--
-- Depends on: 20261104000000_business_gst_settings (gst_registered, authorised_signatory).

update public.company_settings
set
  email = coalesce(email, 'breathcarekart@gmail.com'),
  -- Setting the GSTIN marks the business as registered; an existing GSTIN is left as is.
  gst_registered = case when gstin is null then true else gst_registered end,
  gstin = coalesce(gstin, '36AALCG1309A1Z4'),
  authorised_signatory = coalesce(authorised_signatory, 'Harinath Neelam')
where id;
