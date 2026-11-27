import { redirect } from 'next/navigation';
import { getAdminUser, nonStaffRedirectPath, resolveViewAs } from '@/lib/admin-auth';
import { SiteHeader } from '@/components/site-header';
import { MyArea } from '@/components/my-area';

export const dynamic = 'force-dynamic';

export default async function MinhaAreaControlePage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect(await nonStaffRedirectPath());
  const { viewAs, can } = resolveViewAs(admin, (await searchParams).ver);
  return (
    <main className="display-bg min-h-screen text-[#f0e1b5]">
      <SiteHeader adminEmail={admin.email} permissions={can} viewAs={viewAs} canPreview={admin.isAdmin} />
      <div className="px-5 py-8">
        <div className="mx-auto max-w-4xl"><MyArea embedded /></div>
      </div>
    </main>
  );
}
