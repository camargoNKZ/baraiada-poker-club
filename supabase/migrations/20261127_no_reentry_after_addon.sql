-- Add-on é a última compra do jogador: bloqueia reentrada depois dele.
create or replace function public.record_purchase(
  p_tournament_id integer,
  p_player_id bigint,
  p_kind text,
  p_quantity integer,
  p_unit_amount integer,
  p_total_amount integer,
  p_payment_method text default '',
  p_note text default '',
  p_request_id bigint default null,
  p_resolved_by uuid default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_tx_id bigint;
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_kind not in ('entry', 'reentry', 'addon', 'payment') then
    raise exception 'Lançamento inválido.' using errcode = 'P0001';
  end if;

  perform 1 from public.tournaments where id = p_tournament_id and status = 'active';
  if not found then
    raise exception 'Este torneio não está mais ativo.' using errcode = 'P0001';
  end if;

  select * into v_player from public.players
   where id = p_player_id and tournament_id = p_tournament_id
   for update;
  if not found then
    raise exception 'Jogador não encontrado neste torneio.' using errcode = 'P0001';
  end if;

  if p_request_id is not null then
    update public.player_requests
       set status = 'approved', resolved_at = v_now, resolved_by = p_resolved_by
     where id = p_request_id and status = 'pending';
    if not found then
      raise exception 'Solicitação não encontrada ou já resolvida.' using errcode = 'P0001';
    end if;
  end if;

  if p_kind in ('reentry', 'addon') and v_player.entries < 1 then
    raise exception 'Lance a primeira entrada antes de reentradas ou add-ons.' using errcode = 'P0001';
  end if;
  if p_kind = 'addon' and v_player.addons >= 1 then
    raise exception 'Este jogador já lançou o add-on deste torneio.' using errcode = 'P0001';
  end if;
  -- O add-on é a última compra: depois dele não há mais reentradas.
  if p_kind = 'reentry' and v_player.addons >= 1 then
    raise exception 'Depois do add-on não é possível fazer reentrada.' using errcode = 'P0001';
  end if;

  insert into public.financial_transactions
    (tournament_id, player_id, kind, quantity, unit_amount, total_amount, payment_method, note, created_at, voided_at)
  values
    (p_tournament_id, p_player_id, p_kind, case when p_kind = 'payment' then 1 else greatest(1, p_quantity) end,
     p_unit_amount, p_total_amount, coalesce(p_payment_method, ''), coalesce(p_note, ''), v_now, null)
  returning id into v_tx_id;

  if p_kind = 'entry' then
    update public.players
       set entries = entries + greatest(1, p_quantity),
           status = case when status = 'registered' then 'active' else status end
     where id = p_player_id;
  elsif p_kind = 'reentry' then
    update public.players set reentries = reentries + greatest(1, p_quantity) where id = p_player_id;
  elsif p_kind = 'addon' then
    update public.players set addons = addons + greatest(1, p_quantity) where id = p_player_id;
  end if;

  return v_tx_id;
exception
  when unique_violation then
    raise exception 'Este jogador já lançou o add-on deste torneio.' using errcode = 'P0001';
end;
$$;
