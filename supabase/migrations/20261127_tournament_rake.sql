-- Rake opcional por torneio: percentual descontado do total arrecadado antes da premiação.
alter table public.tournaments add column if not exists rake_enabled boolean not null default false;
alter table public.tournaments add column if not exists rake_percent numeric(5,2) not null default 0 check (rake_percent >= 0 and rake_percent <= 50);
