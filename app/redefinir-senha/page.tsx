import { ResetPasswordForm } from '@/components/reset-password-form';

export const dynamic = 'force-dynamic';

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  return <ResetPasswordForm initialCode={typeof codigo === 'string' ? codigo : ''} />;
}
