import { ControlDashboard } from '@/components/control-dashboard';
import { SiteHeader } from '@/components/site-header';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, isAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function ControlPage() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!isAdminSession(token)) redirect('/login');
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader /><ControlDashboard /></main>;
}
