'use client';

import { CircleDollarSign, ExternalLink, Inbox, LogOut, Menu, Settings2, Trophy, Tv, UserCog, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

const NAV_ITEMS = [
  { href: '/controle', label: 'Controle', icon: Settings2 },
  { href: '/controle/solicitacoes', label: 'Solicitações', icon: Inbox },
  { href: '/controle/admins', label: 'Equipe', icon: UserCog },
  { href: '/controle/meu-jogo', label: 'Meu Jogo', icon: CircleDollarSign },
  { href: '/ranking', label: 'Ranking', icon: Trophy, external: true },
  { href: '/painel', label: 'Painel', icon: Tv, external: true },
];

export function SiteHeader({ adminEmail }: { adminEmail?: string } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#c9a45a]/25 bg-[#0d0c0a]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between gap-3 px-5 lg:px-8">
        <Link href="/controle" className="flex min-w-0 items-center gap-3">
          <span className="size-12 shrink-0 overflow-hidden rounded-full border-2 border-[#c9a45a] shadow-[0_0_0_3px_rgb(201_164_90/12%)]"><img src="/baraiada-logo.jpg" alt="Baraiada Poker Club" width="48" height="48" className="size-full object-cover" /></span>
          <span className="min-w-0"><span className="block truncate font-heading text-[16px] font-bold uppercase tracking-[0.08em] text-[#f0e1b5] sm:text-[18px]">Baraiada</span><span className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9a45a] sm:block">Poker Club · Since 2025</span></span>
        </Link>

        <nav aria-label="Áreas do sistema" className="hidden items-center rounded-full border border-white/8 bg-white/[0.035] p-1 md:flex">
          {NAV_ITEMS.map(({ href, label, icon: Icon, external }) => (
            <Link key={href} href={href} target={external ? '_blank' : undefined} className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${pathname === href ? 'bg-[#c9a45a] text-[#171008]' : 'text-[#a48e6a] hover:text-[#f0e1b5]'}`}><Icon className="size-3.5" /> {label} {external && <ExternalLink className="hidden size-3 sm:block" />}</Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {adminEmail && <span className="max-w-[160px] truncate text-xs text-[#a48e6a]">{adminEmail}</span>}
          <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[#a48e6a] hover:text-[#f0e1b5]"><LogOut className="size-3.5" /> Sair</button>
        </div>

        <button aria-label="Abrir menu" onClick={() => setMenuOpen((value) => !value)} className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 text-[#f0e1b5] md:hidden">{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </div>

      {menuOpen && (
        <div className="border-t border-[#c9a45a]/15 bg-[#0d0c0a] px-5 py-4 md:hidden">
          <nav aria-label="Áreas do sistema (mobile)" className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon, external }) => (
              <Link key={href} href={href} target={external ? '_blank' : undefined} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${pathname === href ? 'bg-[#c9a45a] text-[#171008]' : 'text-[#a48e6a] hover:bg-white/5 hover:text-[#f0e1b5]'}`}><Icon className="size-4" /> {label} {external && <ExternalLink className="ml-auto size-3.5" />}</Link>
            ))}
          </nav>
          {adminEmail && <p className="mt-3 truncate px-4 text-xs text-[#a48e6a]">{adminEmail}</p>}
          <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-[#a48e6a] hover:text-[#f0e1b5]"><LogOut className="size-4" /> Sair</button>
        </div>
      )}
    </header>
  );
}
