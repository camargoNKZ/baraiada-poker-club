import { redirect } from 'next/navigation';
import { getAdminUser, nonStaffRedirectPath } from '@/lib/admin-auth';
import { SiteHeader } from '@/components/site-header';
import { ExternalTournaments } from '@/components/external-tournaments';

export const dynamic = 'force-dynamic';

export default async function TorneiosExternosPage() {
  const admin = await getAdminUser();
  if (!admin) redirect(await nonStaffRedirectPath());
  if (!admin.can.admin) redirect('/controle');
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} permissions={admin.can} canPreview={admin.isAdmin} /><ExternalTournaments /></main>;
}
