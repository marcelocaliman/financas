-- ============================================================================
-- credit_card_bill_amount: estornos/créditos abatem a fatura
-- ============================================================================
-- Bug (auditoria, cartao#1): o applier de fatura registra estornos/devoluções
-- como kind='income' com o mesmo bill_period_end da fatura, mas a função só
-- somava kind='expense' — então um crédito nunca reduzia o "A pagar", inflando
-- a fatura exibida e fazendo o auto-sync transferir valor a mais.
--
-- Fix: somar com sinal — despesa soma, income (estorno/crédito/cashback)
-- subtrai. O pagamento da fatura continua sendo kind='transfer' (direction in)
-- e fica de fora, como antes. Mantém a janela bill_period_end-OU-date.
-- ============================================================================
create or replace function public.credit_card_bill_amount(
  p_card_id uuid,
  p_due_date date
)
returns numeric
language plpgsql
stable
as $$
declare
  v_close_day int;
  v_due_day int;
  v_window record;
  v_total numeric;
begin
  select bill_close_day, bill_due_day
    into v_close_day, v_due_day
  from public.accounts
  where id = p_card_id and type = 'credit_card';

  if v_close_day is null then
    return null;
  end if;

  select * into v_window
  from public.bill_window_for_due_date(
    v_close_day,
    coalesce(v_due_day, v_close_day),
    p_due_date
  );

  -- Soma com sinal, na mesma janela (bill_period_end explícito ou date fallback):
  --   expense  -> soma   (compra)
  --   income   -> subtrai (estorno/devolução/crédito de fatura)
  -- transfer (pagamento da fatura) fica de fora.
  select coalesce(sum(
           case
             when kind = 'expense' then amount_account
             when kind = 'income' then -amount_account
             else 0
           end
         ), 0) into v_total
  from public.transactions
  where account_id = p_card_id
    and kind in ('expense', 'income')
    and (
      bill_period_end = v_window.period_end
      OR (
        bill_period_end is null
        AND date >= v_window.period_start
        AND date <= v_window.period_end
      )
    );

  return v_total;
end;
$$;

revoke all on function public.credit_card_bill_amount(uuid, date) from public;
grant execute on function public.credit_card_bill_amount(uuid, date) to authenticated, service_role;

comment on function public.credit_card_bill_amount is
  'Calcula o total da fatura de um cartão que vence em p_due_date. Usa '
  'bill_period_end quando explícito (preciso pra parcelas) e cai pra date como '
  'fallback. Soma kind=expense e SUBTRAI kind=income (estornos/créditos).';
