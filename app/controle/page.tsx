import { ControlDashboard } from '@/components/control-dashboard';
import { SiteHeader } from '@/components/site-header';
import { redirect } from 'next/navigation';
import { getAdminUser, nonStaffRedirectPath, resolveViewAs } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function ControlPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect(await nonStaffRedirectPath());
  const { viewAs, can } = resolveViewAs(admin, (await searchParams).ver);
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} permissions={can} viewAs={viewAs} canPreview={admin.isAdmin} /><ControlDashboard previewCan={viewAs === 'admin' ? undefined : can} /></main>;
}
