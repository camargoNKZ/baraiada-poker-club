import { redirect } from 'next/navigation';
import { getAdminUser, nonStaffRedirectPath } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { loadMembers } from '@/lib/roles';
import { SiteHeader } from '@/components/site-header';
import { AdminsPanel } from '@/components/admins-panel';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect(await nonStaffRedirectPath());
  if (!admin.can.admin) redirect('/controle');
  const { tournament, members } = await loadMembers(getSupabase());
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} permissions={admin.can} canPreview={admin.isAdmin} /><AdminsPanel initialMembers={members} tournament={tournament} currentUserId={admin.id} /></main>;
}
