# Baraiada Poker Club

Sistema de gestão dos torneios do Baraiada: relógio de blinds, inscrições e compras, financeiro, premiação, fechamento e ranking, tudo em tempo real.

## Áreas

| Rota | Quem usa | O que faz |
| --- | --- | --- |
| `/painel` | Todos (TV da sala) | Relógio, blinds, premiação, últimas eliminações. Muda para a paleta verde nos intervalos. |
| `/ranking` | Todos | Ranking anual, pódios com foto e a imagem do ranking para compartilhar. |
| `/jogador` | Jogador | Inscrição (simples ou dupla), reentrada, add-on no intervalo, Pix e "Já paguei", prêmios e a aba **Minha área** (estatísticas do ano). |
| `/controle` | Equipe | Relógio, estrutura de blinds, cadastro, lançamentos, configuração do torneio e divulgação no WhatsApp. |
| `/controle/solicitacoes` | Financeiro | Aprova pedidos de compra e os "Já paguei" com comprovante. |
| `/controle/fechamento` | Financeiro | Resumo do dinheiro, pagamento dos prêmios com comprovante, foto do top 3 e "Finalizar fechamento". |
| `/controle/torneios-externos` | Admin | Torneios jogados fora do sistema, vinculados ao cadastro dos jogadores. |
| `/controle/admins`, `/controle/historico` | Admin | Cargos (Dealer e Financeiro por torneio), códigos de redefinição de senha e histórico de ações. |

## Regras importantes

- **Cargos:** Administrador é fixo. Dealer (relógio, jogadores e eliminações) e Financeiro (lançamentos e aprovações) valem por torneio e dão desconto. Admin não tem desconto, a menos que tenha um desses cargos no torneio.
- **Janelas de compra:** entrada e reentrada valem até o fim do 1º intervalo. O add-on só pode ser feito durante o 1º intervalo e é a última compra.
- **Dinheiro:** todos os valores ficam em centavos. Prêmios e rake são sempre múltiplos de R$ 5. Os prêmios exibidos já descontam o rake.
- **Sem devedores entre torneios:** o torneio não encerra enquanto houver saldo em aberto ou "Já paguei" pendente.

## Stack

- **Next.js** (App Router) + **React 19** + **Tailwind CSS**, com deploy na **Vercel** (região `gru1`, São Paulo).
- **Supabase** (região `sa-east-1`): Postgres com RLS (o acesso é feito só pelo servidor, com a service role), Auth, Storage e Realtime (canal `baraiada-tournament`).
- As operações de dinheiro são atômicas, feitas em funções SQL (`record_purchase`, `void_transaction`, `finish_tournament`). As migrações ficam em `supabase/migrations/`.
- PWA instalável (`app/manifest.ts`, `public/sw.js`).

## Desenvolvimento

```bash
npm install
npm run dev      # requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm test         # testes dos cálculos de prêmio, rake, saldo e janelas de compra
npm run build
```
