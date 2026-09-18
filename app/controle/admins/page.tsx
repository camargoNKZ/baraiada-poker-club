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
  const { data } = await db.from('admin_profiles').select('user_id, email, created_at').order('created_at', { ascending: true });
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} /><AdminsPanel admins={data ?? []} currentUserId={admin.id} /></main>;
}
