-- Torneios que aconteceram fora do sistema, registrados só com a classificação (contam no ranking).
alter table public.tournaments add column if not exists external boolean not null default false;
-- Total arrecadado informado para o torneio externo (para calcular rake e premiação no fechamento).
alter table public.tournaments add column if not exists external_gross integer not null default 0 check (external_gross >= 0);
