import { ControlDashboard } from '@/components/control-dashboard';
import { SiteHeader } from '@/components/site-header';
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function ControlPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login');
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader adminEmail={admin.email} /><ControlDashboard /></main>;
}
