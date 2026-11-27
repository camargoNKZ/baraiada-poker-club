-- Até 4 modelos de estrutura de blinds salvos pela administração.
create table if not exists public.blind_templates (
  slot smallint primary key check (slot between 1 and 4),
  name text not null,
  levels jsonb not null,
  updated_at bigint not null,
  updated_by text not null default ''
);
alter table public.blind_templates enable row level security;
revoke all on public.blind_templates from anon, authenticated;
