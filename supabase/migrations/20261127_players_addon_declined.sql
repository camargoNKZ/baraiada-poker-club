-- Jogador respondeu "não" ao add-on no intervalo (libera o alerta de pagamento).
alter table public.players add column if not exists addon_declined boolean not null default false;
