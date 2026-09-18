import { redirect } from 'next/navigation';
import { getPlayerProfile } from '@/lib/player-auth';
import { getAdminUser } from '@/lib/admin-auth';
import { PlayerDashboard } from '@/components/player-dashboard';

export const dynamic = 'force-dynamic';

export default async function JogadorPage() {
  const profile = await getPlayerProfile();
  if (!profile) {
    const admin = await getAdminUser();
    redirect(admin ? '/controle' : '/login');
  }
  return <PlayerDashboard profile={profile} />;
}
