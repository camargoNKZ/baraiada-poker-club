-- Operações financeiras e encerramento de torneio atômicos.
-- Cada função roda numa única transação do Postgres e trava a linha do
-- jogador/torneio, evitando contadores divergentes e lançamentos duplicados.

-- Um único add-on ativo (não estornado) por jogador, garantido pelo banco.
create unique index if not exists idx_financial_transactions_one_addon
  on public.financial_transactions (player_id)
  where kind = 'addon' and voided_at is null;

-- Um único conjunto de resultados por torneio/posição.
create unique index if not exists idx_tournament_results_unique_position
  on public.tournament_results (tournament_id, "position");

-- Registra entrada/reentrada/add-on/pagamento e atualiza o contador do jogador.
-- Se p_request_id for informado, aprova a solicitação na mesma transação
-- (só se ainda estiver pendente).
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

-- Estorna um lançamento e desfaz o contador do jogador.
create or replace function public.void_transaction(p_tournament_id integer, p_transaction_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.financial_transactions%rowtype;
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  update public.financial_transactions
     set voided_at = v_now
   where id = p_transaction_id and tournament_id = p_tournament_id and voided_at is null
  returning * into v_tx;
  if not found then
    raise exception 'Lançamento não encontrado ou já estornado.' using errcode = 'P0001';
  end if;

  perform 1 from public.players where id = v_tx.player_id for update;

  if v_tx.kind = 'entry' then
    update public.players
       set entries = greatest(0, entries - v_tx.quantity),
           status = case when greatest(0, entries - v_tx.quantity) = 0 then 'registered' else status end,
           eliminated_at = case when greatest(0, entries - v_tx.quantity) = 0 then null else eliminated_at end
     where id = v_tx.player_id;
  elsif v_tx.kind = 'reentry' then
    update public.players set reentries = greatest(0, reentries - v_tx.quantity) where id = v_tx.player_id;
  elsif v_tx.kind = 'addon' then
    update public.players set addons = greatest(0, addons - v_tx.quantity) where id = v_tx.player_id;
  end if;
end;
$$;

-- Encerra o torneio e grava a classificação final de uma vez só.
-- Só funciona enquanto o torneio estiver ativo: um segundo clique falha
-- sem gravar resultados duplicados.
create or replace function public.finish_tournament(p_tournament_id integer, p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  update public.tournaments
     set status = 'finished', finished_at = v_now
   where id = p_tournament_id and status = 'active';
  if not found then
    raise exception 'Este torneio já foi encerrado.' using errcode = 'P0001';
  end if;

  insert into public.tournament_results (tournament_id, player_id, player_name, "position", points, prize_amount, created_at)
  select p_tournament_id, (r->>'player_id')::bigint, r->>'player_name', (r->>'position')::integer,
         coalesce((r->>'points')::integer, 0), coalesce((r->>'prize_amount')::integer, 0), v_now
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r;
end;
$$;

revoke all on function public.record_purchase(integer, bigint, text, integer, integer, integer, text, text, bigint, uuid) from public, anon, authenticated;
revoke all on function public.void_transaction(integer, bigint) from public, anon, authenticated;
revoke all on function public.finish_tournament(integer, jsonb) from public, anon, authenticated;
grant execute on function public.record_purchase(integer, bigint, text, integer, integer, integer, text, text, bigint, uuid) to service_role;
grant execute on function public.void_transaction(integer, bigint) to service_role;
grant execute on function public.finish_tournament(integer, jsonb) to service_role;
