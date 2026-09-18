import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin-auth';
import { SiteHeader } from '@/components/site-header';
import { AdminSelfPlay } from '@/components/admin-self-play';

export const dynamic = 'force-dynamic';

export default async function MeuJogoPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login');
  return (
    <main className="display-bg min-h-screen text-[#f0e1b5]">
      <SiteHeader adminEmail={admin.email} />
      <div className="px-5 py-8">
        <AdminSelfPlay />
      </div>
    </main>
  );
}
