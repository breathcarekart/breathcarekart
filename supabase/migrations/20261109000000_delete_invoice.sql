-- Delete an invoice safely (Invoices list → ⋯ → Delete invoice).
--
-- Who: admins and telecallers (public.is_office()), the same roles the existing
-- invoices_delete policy allows.
--
-- What is removed with the invoice:
--   * its line items (invoice_items, ON DELETE CASCADE as before)
--   * its WhatsApp log rows (whatsapp_messages has no ON DELETE rule, so the invoice
--     couldn't be deleted otherwise). The count is kept in the activity log entry.
-- What is never touched:
--   * payments: an invoice with any payment recorded is REFUSED. (payments.invoice_id is
--     ON DELETE CASCADE, so a plain DELETE would silently remove them.)
--   * the customer, rental and sale (invoices only point at them).
--   * the stored invoice PDF (a private file; storage objects aren't deleted from SQL).
--
-- Races: the invoice row is locked FOR UPDATE, the same lock record_payment() takes,
-- so a payment can't be recorded between the check and the delete. A WhatsApp send
-- still in progress is refused rather than deleted from under the Edge Function.
--
-- No data is changed by this migration.
-- Rollback: supabase/rollbacks/20261109000000_delete_invoice.rollback.sql

create or replace function public.delete_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_inv public.invoices;
  v_payments int;
  v_sending int;
  v_messages int;
  v_items int;
begin
  if not public.is_office() then
    raise exception 'You don''t have permission to delete invoices' using errcode = '42501';
  end if;

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found. It may already have been deleted.';
  end if;

  select count(*) into v_payments from public.payments where invoice_id = p_invoice_id;
  if v_payments > 0 then
    raise exception '% has % payment% recorded, so it can''t be deleted. Payments are never deleted with an invoice.',
      v_inv.invoice_number, v_payments, case when v_payments = 1 then '' else 's' end;
  end if;

  select count(*) filter (where status = 'sending'), count(*)
    into v_sending, v_messages
    from public.whatsapp_messages where invoice_id = p_invoice_id;
  if v_sending > 0 then
    raise exception 'A WhatsApp message for % is being sent right now. Try again in a minute.',
      v_inv.invoice_number;
  end if;

  select count(*) into v_items from public.invoice_items where invoice_id = p_invoice_id;

  delete from public.whatsapp_messages where invoice_id = p_invoice_id;
  delete from public.invoices where id = p_invoice_id;  -- invoice_items cascade

  perform public.log_activity('invoice', p_invoice_id, 'deleted',
    'Invoice ' || v_inv.invoice_number || ' deleted',
    jsonb_build_object(
      'invoice_number', v_inv.invoice_number,
      'customer_id', v_inv.customer_id,
      'rental_id', v_inv.rental_id,
      'sale_id', v_inv.sale_id,
      'grand_total', v_inv.grand_total,
      'invoice_date', v_inv.invoice_date,
      'items_removed', v_items,
      'whatsapp_messages_removed', v_messages));

  return jsonb_build_object(
    'invoice_number', v_inv.invoice_number,
    'whatsapp_messages_removed', v_messages);
end;
$$;

revoke execute on function public.delete_invoice(uuid) from public, anon;
grant execute on function public.delete_invoice(uuid) to authenticated;
