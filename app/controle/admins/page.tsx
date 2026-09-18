import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { SiteHeader } from '@/components/site-header';
import { AdminsPanel } from '@/components/admins-panel';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login');
  const db = getSupabase();
  const [staffResult, playersResult] = await Promise.all([
    db.from('admin_profiles').select('user_id, email, name, nickname, phone, created_at').order('created_at', { ascending: true }),
    db.from('player_profiles').select('user_id, name, nickname, phone, email, role, created_at').order('created_at', { ascending: true }),
  ]);
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} /><AdminsPanel admins={staffResult.data ?? []} players={playersResult.data ?? []} currentUserId={admin.id} /></main>;
}
