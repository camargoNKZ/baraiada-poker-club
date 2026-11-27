import { redirect } from 'next/navigation';
import { getAdminUser, nonStaffRedirectPath, resolveViewAs } from '@/lib/admin-auth';
import { SiteHeader } from '@/components/site-header';
import { ClosingPanel } from '@/components/closing-panel';

export const dynamic = 'force-dynamic';

export default async function FechamentoPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect(await nonStaffRedirectPath());
  const { viewAs, can } = resolveViewAs(admin, (await searchParams).ver);
  if (!can.finance) redirect(viewAs === 'admin' ? '/controle' : `/controle?ver=${viewAs}`);
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} permissions={can} viewAs={viewAs} canPreview={admin.isAdmin} /><ClosingPanel /></main>;
}
