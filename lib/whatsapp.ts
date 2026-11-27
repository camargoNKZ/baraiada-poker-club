// Mensagens prontas para o grupo do WhatsApp (abre o WhatsApp com o texto preenchido).
const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const medal = (position: number) => ['🥇', '🥈', '🥉'][position - 1] ?? `${position}º`;

export function openWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export function announcementText(t: { name: string; entryValue: number; reentryValue: number; addonValue: number; pixKey?: string }, origin: string) {
  return [
    '♠️ *Baraiada Poker Club*',
    `*${t.name}* está com inscrições abertas!`,
    '',
    `Entrada: ${brl(t.entryValue)}`,
    `Reentrada: ${brl(t.reentryValue)} (até o fim do 1º intervalo)`,
    `Add-on: ${brl(t.addonValue)} (só no 1º intervalo)`,
    t.pixKey ? `Pix: ${t.pixKey}` : '',
    '',
    `Faça sua inscrição: ${origin}/jogador`,
    `Acompanhe ao vivo: ${origin}/painel`,
  ].filter((line, i, all) => line || all[i - 1]).join('\n');
}

export function resultText(t: { name: string; finishedAt: number | null }, results: { position: number; playerName: string; prize: number }[], origin: string) {
  const date = t.finishedAt ? ` (${new Date(t.finishedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })})` : '';
  const podium = results.filter((r) => r.prize > 0 || r.position <= 3).map((r) => `${medal(r.position)} ${r.playerName}${r.prize ? ` — ${brl(r.prize)}` : ''}`);
  return ['♠️ *Baraiada Poker Club*', `🏆 Resultado: *${t.name}*${date}`, '', ...podium, '', 'Parabéns aos premiados!', `Ranking: ${origin}/ranking`].join('\n');
}
