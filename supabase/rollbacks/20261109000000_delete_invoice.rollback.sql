-- Rollback for 20261109000000_delete_invoice.sql: removes the function and the
-- migration record. Changes no data (invoices already deleted stay deleted).
begin;
set local role postgres;
set local lock_timeout = '15s';
set local statement_timeout = '120s';

drop function if exists public.delete_invoice(uuid) restrict;
delete from supabase_migrations.schema_migrations where version = '20261109000000';

commit;
