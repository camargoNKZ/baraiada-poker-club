import { redirect } from 'next/navigation';
import { getAdminUser, nonStaffRedirectPath } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { SiteHeader } from '@/components/site-header';
import { AuditLogView, type AuditEntry } from '@/components/audit-log';

export const dynamic = 'force-dynamic';

export default async function HistoricoPage({ searchParams }: { searchParams: Promise<{ torneio?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect(await nonStaffRedirectPath());
  if (!admin.can.admin) redirect('/controle');

  const db = getSupabase();
  const tournamentsResult = await db.from('tournaments').select('id, name, status').order('id', { ascending: false }).limit(50);
  const tournaments = (tournamentsResult.data ?? []) as { id: number; name: string; status: string }[];
  const { torneio } = await searchParams;
  // Padrão: torneio ativo (ou o mais recente). "todos" mostra tudo.
  const selected = torneio === 'todos' ? 'todos' : String(Number(torneio) || (tournaments.find((t) => t.status === 'active') ?? tournaments[0])?.id || 'todos');

  let query = db.from('audit_log').select('id, tournament_id, actor_name, action, summary, created_at').order('created_at', { ascending: false }).limit(1000);
  if (selected !== 'todos') query = query.eq('tournament_id', Number(selected));
  const { data } = await query;

  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} permissions={admin.can} /><AuditLogView entries={(data ?? []) as AuditEntry[]} tournaments={tournaments} selected={selected} /></main>;
}
