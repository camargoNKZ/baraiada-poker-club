-- Percentual do prêmio por posição (ex.: [50, 30, 20]). Vazio = divisão padrão automática.
alter table public.tournaments add column if not exists payout_percentages jsonb not null default '[]'::jsonb;
