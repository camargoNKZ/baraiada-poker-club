import { redirect } from 'next/navigation';
import { getPlayerProfile } from '@/lib/player-auth';
import { MyArea } from '@/components/my-area';

export const dynamic = 'force-dynamic';

export default async function MinhaAreaPage() {
  const profile = await getPlayerProfile();
  if (!profile) redirect('/login');
  return <MyArea />;
}
