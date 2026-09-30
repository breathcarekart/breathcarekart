-- Equipment master data as provided by the business. Names only — no prices,
-- quantities, or unit records invented here. Idempotent (safe to re-run).

insert into public.equipment_types (name) values
  ('ICU Bed'),
  ('Oxygen Concentrator'),
  ('DVT Pump'),
  ('BiPAP Machine'),
  ('Trilogy Machine'),
  ('CPAP Machine'),
  ('Ventilator'),
  ('Cardiac Monitor'),
  ('Syringe Pump'),
  ('Hospital ICU Bed'),
  ('Suction Machine'),
  ('Oxygen Cylinder'),
  ('Air Mattress'),
  ('Portable Oxygen Concentrator'),
  ('Wheelchair'),
  ('Nebulizer')
on conflict (name) do nothing;

update public.equipment_types
  set notes = 'Variants: A40, AVAPS'
  where name = 'BiPAP Machine' and notes is null;
