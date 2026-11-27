-- Chave Pix que recebe os pagamentos do torneio (mostrada aos jogadores no alerta de pagamento).
alter table public.tournaments add column if not exists pix_key text not null default '';
