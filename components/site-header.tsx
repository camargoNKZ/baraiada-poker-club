'use client';

import { ExternalLink, Inbox, LogOut, Settings2, Trophy, Tv, UserCog } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export function SiteHeader({ adminEmail }: { adminEmail?: string } = {}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#c9a45a]/25 bg-[#0d0c0a]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between gap-3 px-5 lg:px-8">
        <Link href="/controle" className="flex items-center gap-3">
          <span className="size-12 overflow-hidden rounded-full border-2 border-[#c9a45a] shadow-[0_0_0_3px_rgb(201_164_90/12%)]"><img src="/baraiada-logo.jpg" alt="Baraiada Poker Club" width="48" height="48" className="size-full object-cover" /></span>
          <span><span className="block font-heading text-[18px] font-bold uppercase tracking-[0.08em] text-[#f0e1b5]">Baraiada</span><span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9a45a]">Poker Club · Since 2025</span></span>
        </Link>
        <nav aria-label="Áreas do sistema" className="flex items-center rounded-full border border-white/8 bg-white/[0.035] p-1">
          <Link href="/controle" className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${pathname === '/controle' ? 'bg-[#c9a45a] text-[#171008]' : 'text-[#a48e6a] hover:text-[#f0e1b5]'}`}><Settings2 className="size-3.5" /> Controle</Link>
          <Link href="/controle/solicitacoes" className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${pathname === '/controle/solicitacoes' ? 'bg-[#c9a45a] text-[#171008]' : 'text-[#a48e6a] hover:text-[#f0e1b5]'}`}><Inbox className="size-3.5" /> Solicitações</Link>
          <Link href="/controle/admins" className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${pathname === '/controle/admins' ? 'bg-[#c9a45a] text-[#171008]' : 'text-[#a48e6a] hover:text-[#f0e1b5]'}`}><UserCog className="size-3.5" /> Admins</Link>
          <Link href="/ranking" target="_blank" className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-[#a48e6a] transition hover:text-[#f0e1b5]"><Trophy className="size-3.5" /> Ranking <ExternalLink className="hidden size-3 sm:block" /></Link>
          <Link href="/painel" target="_blank" className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-[#a48e6a] transition hover:text-[#f0e1b5]"><Tv className="size-3.5" /> Painel <ExternalLink className="hidden size-3 sm:block" /></Link>
        </nav>
        {adminEmail && <div className="hidden items-center gap-3 sm:flex"><span className="max-w-[160px] truncate text-xs text-[#a48e6a]">{adminEmail}</span><button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[#a48e6a] hover:text-[#f0e1b5]"><LogOut className="size-3.5" /> Sair</button></div>}
      </div>
    </header>
  );
}
