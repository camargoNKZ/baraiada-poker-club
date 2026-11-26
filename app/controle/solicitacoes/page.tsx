import { redirect } from 'next/navigation';
import { getAdminUser, nonStaffRedirectPath } from '@/lib/admin-auth';
import { SiteHeader } from '@/components/site-header';
import { RequestsPanel } from '@/components/requests-panel';

export const dynamic = 'force-dynamic';

export default async function SolicitacoesPage() {
  const admin = await getAdminUser();
  if (!admin) redirect(await nonStaffRedirectPath());
  if (!admin.can.finance) redirect('/controle');
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} permissions={admin.can} /><RequestsPanel /></main>;
}
