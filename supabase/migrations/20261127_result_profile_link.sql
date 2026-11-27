-- Vincula o resultado de torneio externo ao cadastro do jogador (user_id), para aparecer na Minha área.
alter table public.tournament_results add column if not exists profile_id uuid;
create index if not exists tournament_results_profile_id_idx on public.tournament_results (profile_id);
-- Externos já lançados: vincula quando o nome bate exatamente (sem diferenciar maiúsculas) com um único cadastro.
update public.tournament_results r set profile_id = p.user_id
from public.player_profiles p, public.tournaments t
where t.id = r.tournament_id and t.external and r.profile_id is null and lower(p.name) = lower(r.player_name)
  and (select count(*) from public.player_profiles q where lower(q.name) = lower(r.player_name)) = 1;
