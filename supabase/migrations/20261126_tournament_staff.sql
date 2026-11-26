-- Cargos por torneio: dealer e financeiro.
-- O cargo fixo de Administrador continua em admin_profiles.
-- Quem tem cargo no torneio ganha o desconto de apoio naquele torneio.
create table if not exists public.tournament_staff (
  tournament_id integer not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  role text not null check (role in ('dealer', 'financeiro')),
  assigned_by uuid references auth.users(id),
  assigned_at bigint not null default ((extract(epoch from now()))::bigint * 1000),
  primary key (tournament_id, user_id)
);

create index if not exists idx_tournament_staff_user on public.tournament_staff (user_id);

alter table public.tournament_staff enable row level security;
revoke all on public.tournament_staff from anon, authenticated;
