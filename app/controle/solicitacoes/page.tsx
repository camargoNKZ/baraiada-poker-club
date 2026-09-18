import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin-auth';
import { SiteHeader } from '@/components/site-header';
import { RequestsPanel } from '@/components/requests-panel';

export const dynamic = 'force-dynamic';

export default async function SolicitacoesPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login');
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} /><RequestsPanel /></main>;
}
