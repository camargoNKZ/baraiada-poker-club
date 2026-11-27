-- Fechamento finalizado: depois disso prêmios e foto do top 3 não podem mais ser alterados.
alter table public.tournaments add column if not exists closed_at bigint;
alter table public.tournaments add column if not exists closed_by uuid references auth.users(id);
