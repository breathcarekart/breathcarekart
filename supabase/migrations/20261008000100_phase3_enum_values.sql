-- Phase 3 · 1/5 — enum values used by the sale workflow.
-- Kept in its own migration: a value added with ALTER TYPE can't be used in the
-- same transaction that adds it.

-- A sold unit leaves the rentable fleet but stays on record for history.
alter type public.equipment_status add value if not exists 'sold';
